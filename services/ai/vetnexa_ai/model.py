"""The image classifier: a pre-trained CNN backbone with a new head (transfer learning).

Training a deep network from scratch needs hundreds of thousands of images. Starting from a
network that already recognises edges, textures and shapes lets a few thousand wound photos be
enough to learn the wound types.

Two backbones are supported, both pre-trained on ImageNet (torchvision):

* ``efficientnet_b0`` – the default, as proposed in the project: accurate for its small size
  (5.3 M parameters) and fast enough on a CPU.
* ``resnet18`` – the baseline it is compared with in the evaluation.

The model is split into ``backbone`` (image → feature vector) and ``head`` (features → class
scores) so the out-of-distribution detector can look at the feature vector directly.
"""

from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path

import torch
from torch import nn
from torchvision.models import (
    EfficientNet_B0_Weights,
    ResNet18_Weights,
    efficientnet_b0,
    resnet18,
)

ARCHITECTURES = ("efficientnet_b0", "resnet18")
DEFAULT_ARCH = "efficientnet_b0"


class WoundClassifier(nn.Module):
    def __init__(self, backbone: nn.Module, feature_dim: int, num_classes: int, dropout: float):
        super().__init__()
        self.backbone = backbone
        self.feature_dim = feature_dim
        self.head = nn.Sequential(nn.Dropout(dropout), nn.Linear(feature_dim, num_classes))

    def features(self, images: torch.Tensor) -> torch.Tensor:
        return self.backbone(images)

    def forward(self, images: torch.Tensor) -> torch.Tensor:
        return self.head(self.backbone(images))


def build_model(
    num_classes: int,
    pretrained: bool = True,
    dropout: float = 0.3,
    arch: str = DEFAULT_ARCH,
) -> WoundClassifier:
    """Pre-trained backbone (its own classifier removed) plus a dropout + linear head."""
    if arch == "efficientnet_b0":
        backbone = efficientnet_b0(weights=EfficientNet_B0_Weights.DEFAULT if pretrained else None)
        feature_dim = backbone.classifier[1].in_features
        backbone.classifier = nn.Identity()
    elif arch == "resnet18":
        backbone = resnet18(weights=ResNet18_Weights.DEFAULT if pretrained else None)
        feature_dim = backbone.fc.in_features
        backbone.fc = nn.Identity()
    else:
        raise ValueError(f"Unknown architecture {arch!r}; choose one of {ARCHITECTURES}")
    return WoundClassifier(backbone, feature_dim, num_classes, dropout)


def set_backbone_trainable(model: WoundClassifier, trainable: bool) -> None:
    """Freezes or unfreezes the backbone; the new head always trains.

    Training starts with a frozen backbone so the random new head does not damage the
    pre-trained features, then the whole network is fine-tuned with a small learning rate.
    """
    for parameter in model.backbone.parameters():
        parameter.requires_grad = trainable


def model_name(arch: str, task: str = "wound") -> str:
    return f"{task}-{arch.replace('_', '')}"


def save_checkpoint(
    path: Path,
    model: WoundClassifier,
    classes: tuple[str, ...],
    temperature: float,
    metrics: dict,
    data_summary: dict,
    image_size: int,
    demo: bool = False,
    arch: str = DEFAULT_ARCH,
    ood: dict | None = None,
    task: str = "wound",
) -> str:
    """Saves the weights with everything needed to use and audit them later."""
    name = model_name(arch, task)
    version = f"{name}-{datetime.now(UTC):%Y%m%d-%H%M}"
    path.parent.mkdir(parents=True, exist_ok=True)
    torch.save(
        {
            "model_name": name,
            "arch": arch,
            "version": version,
            "created_at": datetime.now(UTC).isoformat(),
            "classes": list(classes),
            "image_size": image_size,
            # True when trained on synthetic drawings: such a model must never be presented
            # as assessing real photos.
            "demo": demo,
            "temperature": temperature,
            # Out-of-distribution detector fitted on the training and validation data.
            "ood": ood,
            "metrics": metrics,
            "data_summary": data_summary,
            "state_dict": model.state_dict(),
        },
        path,
    )
    return version


def _upgrade_legacy_state(state: dict) -> dict:
    """Checkpoints made before the backbone/head split were plain ResNet-18s."""
    upgraded = {}
    for key, value in state.items():
        if key.startswith("fc."):
            upgraded["head." + key[3:]] = value
        else:
            upgraded["backbone." + key] = value
    return upgraded


def load_checkpoint(path: Path, device: str = "cpu") -> tuple[WoundClassifier, dict]:
    """Loads a saved model for evaluation or inference."""
    checkpoint = torch.load(path, map_location=device, weights_only=False)
    arch = checkpoint.get("arch", "resnet18")
    state = checkpoint["state_dict"]
    if "arch" not in checkpoint:
        state = _upgrade_legacy_state(state)
    model = build_model(len(checkpoint["classes"]), pretrained=False, arch=arch)
    model.load_state_dict(state)
    model.eval()
    checkpoint.setdefault("arch", arch)
    return model, checkpoint
