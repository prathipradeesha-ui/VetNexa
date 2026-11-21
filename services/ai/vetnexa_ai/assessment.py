"""Turning model output and symptom answers into a cautious, explainable triage result.

1. If the photo fails the quality checks, nothing is predicted and the owner is asked to
   retake it – unless emergency signs were reported, which are always urgent.
2. `apply_safety_rules` turns the calibrated probabilities into a wound type, summary and
   guidance (with "uncertain" below SAFETY.min_confidence and escalation towards more serious
   classes).
3. The photo's risk and reliability (quality, familiarity from the OOD detector, certainty)
   and the symptom evidence are combined by reliability-weighted fusion into one of four
   outcomes, with safety overrides (triage.py).
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
    QUALITY,
    SAFETY,
    SEVERITY_ORDER,
    UNCERTAIN_GUIDANCE,
    SafetyRules,
)
from .model import load_checkpoint
from .ood import OODDetector
from .preprocessing import eval_transform
from .quality import check_quality, decode_image
from .symptoms import Answers, evaluate_symptoms
from .triage import RANK, fuse, image_evidence, quality_score


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


RED_FLAG_GUIDANCE = (
    "You reported signs of an emergency. Contact or go to a veterinary clinic now; do not wait "
    "for this assessment. Keep your pet calm and still, and apply gentle pressure to any "
    "bleeding with a clean cloth on the way."
)

#: How each triage outcome is stored in the existing severity field.
OUTCOME_SEVERITY = {
    "ROUTINE": "MINOR",
    "CONSULT": "MODERATE",
    "URGENT": "SEVERE",
    "UNABLE": "UNCERTAIN",
}


def describe(image_result: dict | None, triage: dict, evidence: dict | None) -> dict:
    """Owner-facing fields (status, severity, summary, guidance) for a triage result."""
    outcome = triage["outcome"]
    image_input = next((i for i in triage["inputs"] if i["source"] == "image"), None)
    image_used = image_input is not None and image_input["reliability"] > 0

    if evidence and evidence["redFlags"]:
        labels = "; ".join(flag["label"].lower() for flag in evidence["redFlags"])
        summary = "Emergency signs were reported."
        guidance = f"{RED_FLAG_GUIDANCE} Reported: {labels}."
    elif outcome == "UNABLE":
        summary = "This could not be assessed safely."
        reasons = [note for i in triage["inputs"] for note in i["notes"]]
        guidance = " ".join([*reasons, UNCERTAIN_GUIDANCE])
    elif image_result and image_used:
        summary = image_result["summary"]
        guidance = image_result["guidance"]
    else:
        summary = "The photo could not be used, so this result is based on your answers."
        guidance = (
            "Your answers suggest the urgency shown above. A veterinarian can examine the "
            "problem properly."
        )
        if image_result and outcome == "ROUTINE":
            guidance = image_result["guidance"]

    if triage["overrides"] and not (evidence and evidence["redFlags"]):
        guidance += " " + " ".join(triage["overrides"])

    image_rank = RANK.get(image_input["level"], 0) if image_used else 0
    return {
        "status": "UNCERTAIN" if outcome == "UNABLE" else "ASSESSED",
        "severity": OUTCOME_SEVERITY[outcome],
        "referToVet": outcome != "ROUTINE",
        "escalated": outcome != "UNABLE" and RANK.get(outcome, 0) > image_rank,
        "summary": summary,
        "guidance": guidance,
    }


@dataclass
class Assessor:
    """Loads the trained model (and its OOD detector) once and assesses photos."""

    model: torch.nn.Module
    classes: list[str]
    temperature: float
    version: str
    demo: bool = False
    ood: OODDetector | None = None
    fusion: str = "reliability"

    @classmethod
    def from_checkpoint(cls, path: Path) -> Assessor:
        model, checkpoint = load_checkpoint(path)
        ood = checkpoint.get("ood")
        return cls(
            model,
            checkpoint["classes"],
            checkpoint["temperature"],
            checkpoint["version"],
            bool(checkpoint.get("demo", False)),
            OODDetector.from_dict(ood) if ood else None,
        )

    @torch.no_grad()
    def analyse(self, image: np.ndarray) -> tuple[dict[str, float], dict | None]:
        """Calibrated class probabilities and, when available, the OOD familiarity."""
        batch = eval_transform(image).unsqueeze(0)
        features = self.model.features(batch)
        logits = self.model.head(features)
        probs = torch.softmax(logits[0] / self.temperature, dim=0).numpy()
        probabilities = {name: float(p) for name, p in zip(self.classes, probs, strict=True)}
        ood = self.ood.familiarity(features, logits)[0] if self.ood else None
        return probabilities, ood

    def probabilities(self, image: np.ndarray) -> dict[str, float]:
        return self.analyse(image)[0]

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
            "symptoms": evidence,
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
                "triage": None,
                "ood": None,
            }
            # A poor photo is normally retaken, but emergency signs must never wait for that.
            if evidence and evidence["redFlags"]:
                triage = fuse(None, evidence, self.fusion)
                return {**rejected, **describe(None, triage, evidence), "triage": triage}
            return rejected

        probabilities, ood = self.analyse(image)
        image_result = apply_safety_rules(probabilities)
        score = quality_score(quality.as_dict(), QUALITY)
        image_ev = image_evidence(probabilities, score, ood["familiarity"] if ood else None)
        triage = fuse(image_ev, evidence, self.fusion)
        return {
            **base,
            "predictedClass": image_result["predictedClass"],
            "confidence": image_result["confidence"],
            "probabilities": {k: round(v, 4) for k, v in probabilities.items()},
            **describe(image_result, triage, evidence),
            "triage": triage,
            "ood": ood,
        }
