"""Finding images, splitting them fairly into train / validation / test, and loading them.

Expected folder layout (one folder per class, see config.CLASSES):

    data/wounds/
      laceration/
        case014__1.jpg
        case014__2.jpg      ← two photos of the same wound share the "case014" prefix
        case021.jpg
      abrasion/
      ...

Photos of the same wound (same prefix before "__") are always kept in the same split.
Otherwise the model could be tested on an almost identical photo of a wound it was trained on,
and the test score would look better than real-world performance.
"""

from __future__ import annotations

import hashlib
import json
from collections import Counter
from dataclasses import asdict, dataclass
from pathlib import Path

import cv2
import numpy as np
import torch
from sklearn.model_selection import StratifiedGroupKFold
from torch.utils.data import Dataset

from .config import CLASSES

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


@dataclass
class Sample:
    path: str
    label: int
    group: str  #: photos of the same wound share a group


def group_of(path: Path) -> str:
    """Wound/case identifier from a file name: "case014__2.jpg" → "laceration/case014"."""
    stem = path.stem
    return f"{path.parent.name}/{stem.split('__')[0] if '__' in stem else stem}"


def scan_dataset(root: Path, classes: tuple[str, ...] = CLASSES) -> list[Sample]:
    """Lists all images, skipping exact duplicates (same file content) and unknown folders."""
    missing = [name for name in classes if not (root / name).is_dir()]
    if missing:
        raise FileNotFoundError(f"Missing class folders in {root}: {', '.join(missing)}")

    samples: list[Sample] = []
    seen_hashes: set[str] = set()
    for label, name in enumerate(classes):
        for path in sorted((root / name).rglob("*")):
            if path.suffix.lower() not in IMAGE_EXTENSIONS:
                continue
            digest = hashlib.sha256(path.read_bytes()).hexdigest()
            if digest in seen_hashes:
                continue  # an exact copy would leak between splits
            seen_hashes.add(digest)
            samples.append(Sample(str(path), label, group_of(path)))
    if not samples:
        raise ValueError(f"No images found in {root}")
    return samples


@dataclass
class Split:
    train: list[Sample]
    val: list[Sample]
    test: list[Sample]

    def summary(self, classes: tuple[str, ...] = CLASSES) -> dict:
        def counts(items: list[Sample]) -> dict[str, int]:
            c = Counter(s.label for s in items)
            return {classes[i]: c.get(i, 0) for i in range(len(classes))}

        return {"train": counts(self.train), "val": counts(self.val), "test": counts(self.test)}

    def save(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        data = {key: [asdict(s) for s in getattr(self, key)] for key in ("train", "val", "test")}
        path.write_text(json.dumps(data, indent=2), encoding="utf-8")

    @staticmethod
    def load(path: Path) -> Split:
        data = json.loads(path.read_text(encoding="utf-8"))
        return Split(**{key: [Sample(**s) for s in data[key]] for key in ("train", "val", "test")})


def split_dataset(samples: list[Sample], seed: int = 42) -> Split:
    """About 70% train, 15% validation, 15% test, keeping class proportions and wound groups."""
    labels = np.array([s.label for s in samples])
    groups = np.array([s.group for s in samples])
    indices = np.arange(len(samples))

    def take_fold(idx: np.ndarray, n_splits: int) -> tuple[np.ndarray, np.ndarray]:
        splitter = StratifiedGroupKFold(n_splits=n_splits, shuffle=True, random_state=seed)
        rest, fold = next(splitter.split(idx, labels[idx], groups[idx]))
        return idx[rest], idx[fold]

    remaining, test = take_fold(indices, n_splits=7)  # ~15% test
    train, val = take_fold(remaining, n_splits=6)  # ~15% of the total for validation
    pick = lambda idx: [samples[i] for i in sorted(idx)]  # noqa: E731
    return Split(pick(train), pick(val), pick(test))


def read_rgb(path: str) -> np.ndarray:
    image = cv2.imread(path, cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError(f"Cannot read image {path}")
    return cv2.cvtColor(image, cv2.COLOR_BGR2RGB)


class WoundDataset(Dataset):
    """PyTorch dataset that reads images from disk and applies a transform."""

    def __init__(self, samples: list[Sample], transform):
        self.samples = samples
        self.transform = transform

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, index: int) -> tuple[torch.Tensor, int]:
        sample = self.samples[index]
        return self.transform(read_rgb(sample.path)), sample.label


def class_weights(samples: list[Sample], num_classes: int) -> torch.Tensor:
    """Inverse-frequency weights so rare wound types count as much as common ones."""
    counts = Counter(s.label for s in samples)
    total = len(samples)
    weights = [total / (num_classes * max(counts.get(i, 0), 1)) for i in range(num_classes)]
    return torch.tensor(weights, dtype=torch.float32)
