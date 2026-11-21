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
from .symptoms import Answers, evaluate_symptoms


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


#: Severity suggested by the symptom evidence on its own.
SYMPTOM_SEVERITY = {"routine": "MINOR", "consult": "MODERATE", "urgent": "SEVERE"}

RED_FLAG_GUIDANCE = (
    "You reported signs of an emergency. Contact or go to a veterinary clinic now; do not wait "
    "for this assessment. Keep your pet calm and still, and apply gentle pressure to any "
    "bleeding with a clean cloth on the way."
)


def combine_with_symptoms(result: dict, evidence: dict | None) -> dict:
    """Adds the symptom evidence to an image result, always erring on the side of caution.

    * Red flags override everything: the result is urgent (severe) and refers to a vet.
    * Otherwise the more serious of the image severity and the symptom level is used, and the
      owner is told when the symptoms raised it.
    * An uncertain image stays "uncertain", but the symptoms can still raise its urgency.
    """
    if evidence is None:
        return {**result, "symptoms": None}

    combined = {**result, "symptoms": evidence}
    if evidence["redFlags"]:
        labels = "; ".join(flag["label"].lower() for flag in evidence["redFlags"])
        return {
            **combined,
            "severity": "SEVERE",
            "referToVet": True,
            "escalated": True,
            "summary": "Emergency signs were reported.",
            "guidance": f"{RED_FLAG_GUIDANCE} Reported: {labels}.",
        }

    symptom_severity = SYMPTOM_SEVERITY[evidence["level"]]
    current = result["severity"]
    rank = SEVERITY_ORDER.index
    if current == "UNCERTAIN":
        if evidence["level"] == "routine":
            return combined
        return {
            **combined,
            "severity": symptom_severity,
            "referToVet": True,
            "escalated": True,
            "guidance": result["guidance"]
            + " Your answers about the symptoms also suggest a veterinarian should see your pet.",
        }
    if rank(symptom_severity) > rank(current):
        return {
            **combined,
            "severity": symptom_severity,
            "referToVet": True,
            "escalated": True,
            "guidance": result["guidance"]
            + " Based on the symptoms you described, the urgency has been raised to be on the "
            "safe side.",
        }
    return combined


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

    def assess(self, data: bytes, answers: Answers | None = None) -> dict:
        """Full pipeline for one photo and, optionally, the owner's questionnaire answers.

        Raises InvalidImageError for non-images.
        """
        evidence = evaluate_symptoms(answers) if answers else None
        image = decode_image(data)
        quality = check_quality(image)
        base = {
            "modelVersion": self.version,
            "demoModel": self.demo,
            "quality": quality.as_dict(),
            "disclaimer": DISCLAIMER,
        }
        if not quality.ok:
            rejected = {
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
            # A poor photo is normally retaken, but emergency signs must never wait for that.
            if evidence and evidence["redFlags"]:
                return combine_with_symptoms({**rejected, "status": "UNCERTAIN"}, evidence)
            return {**rejected, "symptoms": evidence}
        probabilities = self.probabilities(image)
        result = {
            **base,
            **apply_safety_rules(probabilities),
            "probabilities": {k: round(v, 4) for k, v in probabilities.items()},
        }
        return combine_with_symptoms(result, evidence)
