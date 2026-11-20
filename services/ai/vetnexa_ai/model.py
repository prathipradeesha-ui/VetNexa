"""The classifier: a ResNet-18 pre-trained on ImageNet with a new final layer (transfer learning).

Training a deep network from scratch needs hundreds of thousands of images. Starting from a
network that already recognises edges, textures and shapes lets a few thousand wound photos
be enough to learn the wound types.
"""

from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path

import torch
from torch import nn
from torchvision.models import ResNet18_Weights, resnet18

MODEL_NAME = "wound-resnet18"


def build_model(num_classes: int, pretrained: bool = True, dropout: float = 0.3) -> nn.Module:
    """ResNet-18 backbone with a dropout + linear head for our classes."""
    model = resnet18(weights=ResNet18_Weights.DEFAULT if pretrained else None)
    model.fc = nn.Sequential(nn.Dropout(dropout), nn.Linear(model.fc.in_features, num_classes))
    return model


def set_backbone_trainable(model: nn.Module, trainable: bool) -> None:
    """Freezes or unfreezes everything except the new head.

    Training starts with a frozen backbone so the random new head does not damage the
    pre-trained features, then the whole network is fine-tuned with a small learning rate.
    """
    for name, parameter in model.named_parameters():
        if not name.startswith("fc."):
            parameter.requires_grad = trainable


def save_checkpoint(
    path: Path,
    model: nn.Module,
    classes: tuple[str, ...],
    temperature: float,
    metrics: dict,
    data_summary: dict,
    image_size: int,
) -> str:
    """Saves the weights with everything needed to use and audit them later."""
    version = f"{MODEL_NAME}-{datetime.now(UTC):%Y%m%d-%H%M}"
    path.parent.mkdir(parents=True, exist_ok=True)
    torch.save(
        {
            "model_name": MODEL_NAME,
            "version": version,
            "created_at": datetime.now(UTC).isoformat(),
            "classes": list(classes),
            "image_size": image_size,
            "temperature": temperature,
            "metrics": metrics,
            "data_summary": data_summary,
            "state_dict": model.state_dict(),
        },
        path,
    )
    return version


def load_checkpoint(path: Path, device: str = "cpu") -> tuple[nn.Module, dict]:
    """Loads a saved model for evaluation or inference."""
    checkpoint = torch.load(path, map_location=device, weights_only=False)
    model = build_model(len(checkpoint["classes"]), pretrained=False)
    model.load_state_dict(checkpoint["state_dict"])
    model.eval()
    return model, checkpoint
