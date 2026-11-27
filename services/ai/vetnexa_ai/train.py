"""Training script.

    python -m vetnexa_ai.train --data-dir data/wounds --epochs 25

Steps:
 1. Scan the dataset and make a group-aware train / validation / test split (saved to JSON
    so evaluation uses exactly the same test images).
 2. Train the new head for a few epochs with the backbone frozen, then fine-tune everything.
 3. Keep the epoch with the best validation macro-F1 (treats every wound type equally), and
    stop early when it stops improving.
 4. Calibrate confidence on the validation set (temperature scaling).
 5. Fit the out-of-distribution detector (ood.py) and save everything in one checkpoint.

Two-stage training (e.g. human wound photos first, then dog and cat photos):

    python -m vetnexa_ai.train --data-dir data/human-wounds --output-dir models/stage1
    python -m vetnexa_ai.train --data-dir data/wounds --init-from models/stage1/wound-classifier.pt
"""

from __future__ import annotations

import argparse
import copy
import json
import random
import time
from pathlib import Path

import numpy as np
import torch
from sklearn.metrics import f1_score
from torch import nn
from torch.utils.data import DataLoader

from .calibration import fit_temperature
from .config import CLASSES, IMAGE_SIZE
from .dataset import WoundDataset, class_weights, scan_dataset, split_dataset
from .model import ARCHITECTURES, DEFAULT_ARCH, build_model, save_checkpoint, set_backbone_trainable
from .ood import fit_ood
from .preprocessing import eval_transform, train_transform


def set_seed(seed: int) -> None:
    """Makes runs repeatable."""
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)


@torch.no_grad()
def predict_logits(model: nn.Module, loader: DataLoader, device: str):
    model.eval()
    all_logits, all_labels = [], []
    for images, labels in loader:
        all_logits.append(model(images.to(device)).cpu())
        all_labels.append(labels)
    return torch.cat(all_logits), torch.cat(all_labels)


def load_initial_weights(model: nn.Module, path: Path) -> None:
    """Starts from an earlier VetNexa checkpoint (two-stage training).

    Example: train first on a large human wound dataset, then continue on the smaller set of
    dog and cat photos. Layers whose shape no longer matches (e.g. a head trained for a
    different list of classes) are skipped and start fresh.
    """
    state = torch.load(path, map_location="cpu", weights_only=False)["state_dict"]
    own = model.state_dict()
    usable = {k: v for k, v in state.items() if k in own and own[k].shape == v.shape}
    model.load_state_dict(usable, strict=False)
    print(f"Initialised {len(usable)}/{len(own)} tensors from {path}")


def run_epoch(model, loader, loss_fn, optimizer, device) -> float:
    model.train()
    total = 0.0
    for images, labels in loader:
        images, labels = images.to(device), labels.to(device)
        optimizer.zero_grad()
        loss = loss_fn(model(images), labels)
        loss.backward()
        optimizer.step()
        total += loss.item() * len(labels)
    return total / len(loader.dataset)


def train(args: argparse.Namespace) -> dict:
    set_seed(args.seed)
    device = "cuda" if torch.cuda.is_available() and not args.cpu else "cpu"
    data_dir, out_dir = Path(args.data_dir), Path(args.output_dir)

    classes = tuple(args.classes.split(",")) if args.classes else CLASSES
    samples = scan_dataset(data_dir, classes)
    split = split_dataset(samples, seed=args.seed)
    split.save(out_dir / "split.json")
    print(f"Images: {len(samples)} | split: {json.dumps(split.summary(classes))}")

    loaders = {
        "train": DataLoader(
            WoundDataset(split.train, train_transform),
            batch_size=args.batch_size,
            shuffle=True,
            num_workers=args.workers,
        ),
        "val": DataLoader(
            WoundDataset(split.val, eval_transform),
            batch_size=args.batch_size,
            num_workers=args.workers,
        ),
    }

    model = build_model(len(classes), pretrained=not args.no_pretrained, arch=args.arch).to(device)
    if args.init_from:
        load_initial_weights(model, Path(args.init_from))
    loss_fn = nn.CrossEntropyLoss(
        weight=class_weights(split.train, len(classes)).to(device), label_smoothing=0.05
    )

    best = {"f1": -1.0, "epoch": 0, "state": None}
    history = []
    epochs_without_improvement = 0
    for epoch in range(1, args.epochs + 1):
        fine_tuning = epoch > args.frozen_epochs
        if epoch == 1 or epoch == args.frozen_epochs + 1:
            set_backbone_trainable(model, fine_tuning)
            lr = args.lr / 10 if fine_tuning else args.lr
            optimizer = torch.optim.AdamW(
                (p for p in model.parameters() if p.requires_grad), lr=lr, weight_decay=1e-4
            )

        started = time.time()
        train_loss = run_epoch(model, loaders["train"], loss_fn, optimizer, device)
        logits, labels = predict_logits(model, loaders["val"], device)
        val_f1 = f1_score(labels, logits.argmax(1), average="macro", zero_division=0)
        val_acc = float((logits.argmax(1) == labels).float().mean())
        history.append(
            {
                "epoch": epoch,
                "train_loss": round(train_loss, 4),
                "val_macro_f1": round(val_f1, 4),
                "val_accuracy": round(val_acc, 4),
            }
        )
        print(
            f"epoch {epoch:>2} | loss {train_loss:.4f} | val acc {val_acc:.3f} | "
            f"val macro-F1 {val_f1:.3f} | {time.time() - started:.0f}s"
        )

        if val_f1 > best["f1"]:
            best = {"f1": val_f1, "epoch": epoch, "state": copy.deepcopy(model.state_dict())}
            epochs_without_improvement = 0
        else:
            epochs_without_improvement += 1
            if fine_tuning and epochs_without_improvement >= args.patience:
                print(f"Stopping early: no improvement for {args.patience} epochs.")
                break

    model.load_state_dict(best["state"])
    logits, labels = predict_logits(model, loaders["val"], device)
    temperature = fit_temperature(logits, labels)
    # The detector uses un-augmented training photos for class centres.
    plain_train = DataLoader(
        WoundDataset(split.train, eval_transform),
        batch_size=args.batch_size,
        num_workers=args.workers,
    )
    ood = fit_ood(model, plain_train, loaders["val"], temperature, device)
    metrics = {
        "best_epoch": best["epoch"],
        "val_macro_f1": round(best["f1"], 4),
        "temperature": round(temperature, 3),
        "history": history,
    }
    version = save_checkpoint(
        out_dir / args.model_file,
        model,
        classes,
        temperature,
        metrics,
        split.summary(classes),
        IMAGE_SIZE,
        demo=args.demo,
        arch=args.arch,
        ood=ood.to_dict(),
        task=args.task,
    )
    print(
        f"Saved {version} (best epoch {best['epoch']}, val macro-F1 {best['f1']:.3f}, "
        f"temperature {temperature:.2f})"
    )
    return {"version": version, **metrics}


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train the VetNexa wound classifier.")
    parser.add_argument("--data-dir", default="data/wounds")
    parser.add_argument(
        "--arch",
        choices=ARCHITECTURES,
        default=DEFAULT_ARCH,
        help="backbone: efficientnet_b0 (default) or the resnet18 baseline",
    )
    parser.add_argument("--output-dir", default="models")
    parser.add_argument(
        "--classes",
        help="comma-separated class folders (default: the wound classes in config.CLASSES)",
    )
    parser.add_argument("--model-file", default="wound-classifier.pt")
    parser.add_argument("--task", default="wound", help="name used in the model version")
    parser.add_argument("--epochs", type=int, default=25)
    parser.add_argument("--frozen-epochs", type=int, default=3)
    parser.add_argument("--patience", type=int, default=5)
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--lr", type=float, default=1e-3)
    parser.add_argument("--workers", type=int, default=0)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument(
        "--init-from", help="continue from an earlier checkpoint (two-stage training)"
    )
    parser.add_argument(
        "--demo",
        action="store_true",
        help="mark the model as a demonstration model (trained on synthetic images)",
    )
    parser.add_argument("--cpu", action="store_true", help="force CPU even if a GPU is available")
    parser.add_argument(
        "--no-pretrained",
        action="store_true",
        help="start from random weights (only for offline tests)",
    )
    return parser.parse_args(argv)


if __name__ == "__main__":
    train(parse_args())
