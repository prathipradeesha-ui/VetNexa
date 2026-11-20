"""Settings for the wound assessment model, kept in one place so they are easy to review.

The class list, the severity of each class and the guidance shown to owners are clinical
decisions. They should be reviewed by a veterinarian before any real-world use.
"""

from __future__ import annotations

from dataclasses import dataclass, field

# ─────────────────────────────── Classes ───────────────────────────────

#: Folder names expected in the dataset (one folder per class) and the model's output order.
CLASSES: tuple[str, ...] = (
    "abrasion",
    "laceration",
    "puncture_wound",
    "abscess_or_infection",
    "healthy_skin",
)

CLASS_LABELS: dict[str, str] = {
    "abrasion": "a graze or abrasion",
    "laceration": "a cut (laceration)",
    "puncture_wound": "a puncture wound, such as a bite",
    "abscess_or_infection": "a possible abscess or infected wound",
    "healthy_skin": "no obvious wound",
}

#: How urgent each class usually is. Infection and punctures are treated as at least moderate
#: because they often look small on the surface but can be serious underneath.
CLASS_SEVERITY: dict[str, str] = {
    "abrasion": "MINOR",
    "laceration": "MODERATE",
    "puncture_wound": "MODERATE",
    "abscess_or_infection": "SEVERE",
    "healthy_skin": "MINOR",
}

SEVERITY_ORDER = ("MINOR", "MODERATE", "SEVERE")

GUIDANCE: dict[str, str] = {
    "abrasion": (
        "Gently clean the area with saline or clean lukewarm water and keep your pet from "
        "licking it. Watch for swelling, discharge or a bad smell over the next few days and "
        "see a vet if any appear."
    ),
    "laceration": (
        "Apply gentle pressure with a clean cloth if it is bleeding, keep the wound clean and "
        "prevent licking. Cuts often need professional cleaning or stitches, so contact a "
        "veterinarian within 24 hours, or immediately if bleeding does not stop."
    ),
    "puncture_wound": (
        "Puncture and bite wounds can look small but trap bacteria deep under the skin. Do not "
        "try to close the wound. Contact a veterinarian within 24 hours; antibiotics are often "
        "needed."
    ),
    "abscess_or_infection": (
        "Swelling, pus or a bad smell suggest infection, which usually needs veterinary "
        "treatment. Please see a veterinarian as soon as possible, and urgently if your pet is "
        "lethargic, not eating or has a fever."
    ),
    "healthy_skin": (
        "The photo does not show an obvious wound. If your pet is in pain, limping or licking "
        "one area, the problem may not be visible in a photo, so please consult a vet."
    ),
}

UNCERTAIN_GUIDANCE = (
    "The model is not confident enough to give a reliable assessment of this photo. Please "
    "consult a veterinarian, especially if the wound is bleeding, swollen or painful."
)

DISCLAIMER = (
    "This is a preliminary, AI-generated assessment from a research prototype. It is not a "
    "diagnosis and does not replace examination by a qualified veterinarian."
)


# ─────────────────────────────── Images ───────────────────────────────


@dataclass(frozen=True)
class QualityThresholds:
    """Limits used to reject photos that cannot be assessed reliably."""

    min_side_px: int = 224  #: smaller images lose too much detail
    max_side_px: int = 8000  #: protects the service from huge images
    min_sharpness: float = 60.0  #: variance of the Laplacian; lower means blurry
    min_brightness: float = 40.0  #: mean grey level 0-255; lower means too dark
    max_brightness: float = 225.0  #: higher means washed out by flash or sunlight
    max_clipped_fraction: float = 0.35  #: share of pixels that are pure black or white


IMAGE_SIZE = 224  #: the size the model sees (pixels, square)
IMAGENET_MEAN = (0.485, 0.456, 0.406)
IMAGENET_STD = (0.229, 0.224, 0.225)


# ─────────────────────────────── Safety rules ───────────────────────────────


@dataclass(frozen=True)
class SafetyRules:
    """How cautious the assessment is. See assessment.py for how these are applied."""

    #: Below this top-class confidence the result is "UNCERTAIN" rather than a guess.
    min_confidence: float = 0.60
    #: If a more serious class has at least this probability, the severity is raised to it.
    escalation_probability: float = 0.25
    #: Classes for which a vet visit is always recommended, whatever the confidence.
    always_refer: tuple[str, ...] = field(
        default=("laceration", "puncture_wound", "abscess_or_infection")
    )


SAFETY = SafetyRules()
QUALITY = QualityThresholds()
