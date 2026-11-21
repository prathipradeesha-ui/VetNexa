"""Out-of-distribution (OOD) detection: does this photo look like the photos the model knows?

A classifier always picks one of its classes, even for a photo of a sofa, a human hand or an
animal it has never seen. Two complementary signals catch such photos:

* **Energy score** ``E = −T · log Σ exp(zᵢ / T)`` from the class scores (logits). Familiar
  photos produce confident, high logits and therefore low energy (Liu et al., 2020).
* **Mahalanobis distance** of the feature vector to the nearest class centre, using a shared
  covariance estimated with Ledoit–Wolf shrinkage (Lee et al., 2018). It notices photos whose
  features are far from every training class even when the logits look confident.

Each threshold is the 97.5th percentile of the score on the validation photos, so about 2.5 %
of familiar photos exceed each one. Scores are turned into a familiarity between 0 and 1 (0.5
exactly at the threshold), and the photo is treated as unfamiliar when either signal says so.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import torch
from sklearn.covariance import LedoitWolf
from torch.utils.data import DataLoader

QUANTILE = 0.975


def energy_score(logits: torch.Tensor, temperature: float) -> torch.Tensor:
    return -temperature * torch.logsumexp(logits / temperature, dim=-1)


@dataclass
class OODDetector:
    class_means: torch.Tensor  # (classes, features)
    precision: torch.Tensor  # (features, features), inverse shared covariance
    temperature: float
    energy_threshold: float
    energy_scale: float
    distance_threshold: float
    distance_scale: float

    def mahalanobis(self, features: torch.Tensor) -> torch.Tensor:
        """Squared distance of each feature vector to its nearest class centre."""
        diff = features[:, None, :] - self.class_means[None, :, :]
        distances = torch.einsum("bcf,fg,bcg->bc", diff, self.precision, diff)
        return distances.min(dim=1).values

    def familiarity(self, features: torch.Tensor, logits: torch.Tensor) -> list[dict]:
        energy = energy_score(logits, self.temperature)
        distance = self.mahalanobis(features)
        results = []
        for e, d in zip(energy.tolist(), distance.tolist(), strict=True):
            unfamiliar_e = _sigmoid((e - self.energy_threshold) / self.energy_scale)
            unfamiliar_d = _sigmoid((d - self.distance_threshold) / self.distance_scale)
            score = 1 - max(unfamiliar_e, unfamiliar_d)
            results.append(
                {
                    "familiarity": round(score, 4),
                    "outOfDistribution": score < 0.5,
                    "energy": round(e, 4),
                    "distance": round(d, 2),
                }
            )
        return results

    def to_dict(self) -> dict:
        return {
            "class_means": self.class_means,
            "precision": self.precision,
            "temperature": self.temperature,
            "energy_threshold": self.energy_threshold,
            "energy_scale": self.energy_scale,
            "distance_threshold": self.distance_threshold,
            "distance_scale": self.distance_scale,
            "quantile": QUANTILE,
        }

    @classmethod
    def from_dict(cls, data: dict) -> OODDetector:
        return cls(
            torch.as_tensor(data["class_means"], dtype=torch.float32),
            torch.as_tensor(data["precision"], dtype=torch.float32),
            float(data["temperature"]),
            float(data["energy_threshold"]),
            float(data["energy_scale"]),
            float(data["distance_threshold"]),
            float(data["distance_scale"]),
        )


def _sigmoid(x: float) -> float:
    return float(1 / (1 + np.exp(-np.clip(x, -50, 50))))


@torch.no_grad()
def collect(model, loader: DataLoader, device: str = "cpu"):
    """Feature vectors, logits and labels for every image in a loader."""
    model.eval()
    features, logits, labels = [], [], []
    for images, targets in loader:
        f = model.features(images.to(device))
        features.append(f.cpu())
        logits.append(model.head(f).cpu())
        labels.append(targets)
    return torch.cat(features), torch.cat(logits), torch.cat(labels)


def fit_ood(
    model, train_loader: DataLoader, val_loader: DataLoader, temperature: float, device: str = "cpu"
) -> OODDetector:
    """Class centres and covariance from training photos, thresholds from validation photos."""
    train_f, _, train_y = collect(model, train_loader, device)
    classes = int(train_y.max()) + 1
    means = torch.stack(
        [
            train_f[train_y == c].mean(0) if (train_y == c).any() else train_f.mean(0)
            for c in range(classes)
        ]
    )
    centred = (train_f - means[train_y]).numpy()
    precision = torch.as_tensor(LedoitWolf().fit(centred).precision_, dtype=torch.float32)

    detector = OODDetector(means, precision, temperature, 0.0, 1.0, 0.0, 1.0)
    val_f, val_logits, _ = collect(model, val_loader, device)
    energy = energy_score(val_logits, temperature).numpy()
    distance = detector.mahalanobis(val_f).numpy()
    detector.energy_threshold = float(np.quantile(energy, QUANTILE))
    detector.energy_scale = float(max(energy.std(), 1e-3))
    detector.distance_threshold = float(np.quantile(distance, QUANTILE))
    detector.distance_scale = float(max(distance.std(), 1e-3))
    return detector
