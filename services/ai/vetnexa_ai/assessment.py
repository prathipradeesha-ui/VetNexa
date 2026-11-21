"""Turning model output into a cautious, explainable assessment.

The model only produces probabilities. `apply_safety_rules` decides what the owner is told:

 1. If the photo fails the quality checks, nothing is predicted. The owner is asked to retake it.
 2. If the top probability is below SAFETY.min_confidence, the result is UNCERTAIN and the owner
    is advised to see a vet. The model does not guess.
 3. Severity starts from the most likely class, then is RAISED if a more serious class is still
    reasonably likely (≥ SAFETY.escalation_probability). Mistaking a serious wound for a minor
    one is worse than the opposite, so the rules lean towards caution.
 4. Cuts, punctures and infections always recommend a veterinarian.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import numpy as np
import torch

from .config import (
    CLASS_LABELS,
    CLASS_SEVERITY,
    DISCLAIMER,
    GUIDANCE,
    SAFETY,
    SEVERITY_ORDER,
    UNCERTAIN_GUIDANCE,
    SafetyRules,
)
from .model import load_checkpoint
from .preprocessing import eval_transform
from .quality import check_quality, decode_image


def apply_safety_rules(probabilities: dict[str, float], rules: SafetyRules = SAFETY) -> dict:
    """Decides severity, referral and guidance from the class probabilities."""
    ranked = sorted(probabilities.items(), key=lambda item: item[1], reverse=True)
    top_class, confidence = ranked[0]

    if confidence < rules.min_confidence:
        return {
            "status": "UNCERTAIN",
            "predictedClass": top_class,
            "confidence": round(confidence, 4),
            "severity": "UNCERTAIN",
            "referToVet": True,
            "summary": "The photo could not be assessed confidently.",
            "guidance": UNCERTAIN_GUIDANCE,
            "escalated": False,
        }

    severity = CLASS_SEVERITY[top_class]
    escalated_by: str | None = None
    for name, probability in ranked[1:]:
        candidate = CLASS_SEVERITY[name]
        if probability >= rules.escalation_probability and SEVERITY_ORDER.index(
            candidate
        ) > SEVERITY_ORDER.index(severity):
            severity, escalated_by = candidate, name

    guidance = GUIDANCE[top_class]
    if escalated_by:
        guidance += (
            f" The model also sees signs of {CLASS_LABELS[escalated_by]}, so the urgency has "
            "been raised to be on the safe side."
        )

    refer = top_class in rules.always_refer or severity in ("MODERATE", "SEVERE")
    return {
        "status": "ASSESSED",
        "predictedClass": top_class,
        "confidence": round(confidence, 4),
        "severity": severity,
        "referToVet": refer,
        "summary": f"The photo most likely shows {CLASS_LABELS[top_class]}.",
        "guidance": guidance,
        "escalated": escalated_by is not None,
    }


@dataclass
class Assessor:
    """Loads the trained model once and assesses photos."""

    model: torch.nn.Module
    classes: list[str]
    temperature: float
    version: str
    demo: bool = False

    @classmethod
    def from_checkpoint(cls, path: Path) -> Assessor:
        model, checkpoint = load_checkpoint(path)
        return cls(
            model,
            checkpoint["classes"],
            checkpoint["temperature"],
            checkpoint["version"],
            bool(checkpoint.get("demo", False)),
        )

    @torch.no_grad()
    def probabilities(self, image: np.ndarray) -> dict[str, float]:
        logits = self.model(eval_transform(image).unsqueeze(0))[0]
        probs = torch.softmax(logits / self.temperature, dim=0).numpy()
        return {name: float(p) for name, p in zip(self.classes, probs, strict=True)}

    def assess(self, data: bytes) -> dict:
        """Full pipeline for one uploaded photo. Raises InvalidImageError for non-images."""
        image = decode_image(data)
        quality = check_quality(image)
        base = {
            "modelVersion": self.version,
            "demoModel": self.demo,
            "quality": quality.as_dict(),
            "disclaimer": DISCLAIMER,
        }
        if not quality.ok:
            return {
                **base,
                "status": "REJECTED_QUALITY",
                "predictedClass": None,
                "confidence": None,
                "severity": "UNCERTAIN",
                "referToVet": False,
                "summary": "This photo cannot be assessed reliably.",
                "guidance": " ".join(quality.problems),
                "escalated": False,
                "probabilities": {},
            }
        probabilities = self.probabilities(image)
        return {
            **base,
            **apply_safety_rules(probabilities),
            "probabilities": {k: round(v, 4) for k, v in probabilities.items()},
        }
