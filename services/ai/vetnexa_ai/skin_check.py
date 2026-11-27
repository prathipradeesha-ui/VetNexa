"""Skin-condition check: a second, advisory model trained on real dog and cat photos.

It looks at the same photo as the wound check and suggests which common skin condition the photo
most resembles (healthy, ringworm, mange, other fungal infection, dermatitis). It is advisory only:
it never changes the triage outcome, which stays with the wound model, the symptom answers and the
safety rules. When the photo looks unlike the training photos, or no class is clearly ahead, it
says so instead of guessing.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import numpy as np
import torch

from .model import load_checkpoint
from .ood import OODDetector
from .preprocessing import eval_transform
from .skin_dataset import SKIN_CLASS_LABELS

#: Below this calibrated confidence the check reports "unsure" rather than a condition.
MIN_CONFIDENCE = 0.55

SKIN_ADVICE = {
    "healthy": "The skin looks most like healthy skin. Keep an eye on it and check again if "
    "anything changes.",
    "ringworm": "The skin looks most like ringworm. It is contagious to other pets and people, "
    "so wash hands after touching the area and ask a vet to confirm and treat it.",
    "mange": "The skin looks most like mange or scabies (mites). Some types spread to other "
    "animals and people; a vet can confirm with a skin scrape and treat it.",
    "fungal_infection": "The skin looks most like a fungal infection. A vet can confirm it and "
    "prescribe the right treatment.",
    "dermatitis": "The skin looks most like inflamed or allergic skin (dermatitis, allergy or "
    "bacterial infection). Stop your pet scratching or licking it and ask a vet for advice.",
}


@dataclass
class SkinChecker:
    model: torch.nn.Module
    classes: list[str]
    temperature: float
    version: str
    ood: OODDetector | None = None

    @classmethod
    def from_checkpoint(cls, path: Path) -> SkinChecker:
        model, checkpoint = load_checkpoint(path)
        ood = checkpoint.get("ood")
        return cls(
            model,
            checkpoint["classes"],
            checkpoint["temperature"],
            checkpoint["version"],
            OODDetector.from_dict(ood) if ood else None,
        )

    @torch.no_grad()
    def check(self, image: np.ndarray) -> dict:
        """Advisory skin-condition result for one RGB photo that passed the quality checks."""
        batch = eval_transform(image).unsqueeze(0)
        features = self.model.features(batch)
        logits = self.model.head(features)
        probs = torch.softmax(logits[0] / self.temperature, dim=0).numpy()
        pairs = zip(self.classes, probs, strict=True)
        probabilities = {name: round(float(p), 4) for name, p in pairs}
        top = max(probabilities, key=probabilities.get)
        confidence = probabilities[top]
        ood = self.ood.familiarity(features, logits)[0] if self.ood else None
        base = {"modelVersion": self.version, "probabilities": probabilities, "ood": ood}
        if ood and ood.get("outOfDistribution"):
            return {
                **base,
                "status": "UNFAMILIAR",
                "condition": None,
                "label": None,
                "confidence": None,
                "advice": "This photo looks different from the skin photos the check learned "
                "from, so it gives no suggestion. Please ask a vet if you are worried.",
            }
        if confidence < MIN_CONFIDENCE:
            return {
                **base,
                "status": "UNSURE",
                "condition": None,
                "label": None,
                "confidence": round(confidence, 4),
                "advice": "The check is not sure which skin condition this is. A vet can tell "
                "you, especially if the skin is red, itchy, crusty or losing hair.",
            }
        return {
            **base,
            "status": "SUGGESTED",
            "condition": top,
            "label": SKIN_CLASS_LABELS[top],
            "confidence": round(confidence, 4),
            "advice": SKIN_ADVICE[top],
        }
