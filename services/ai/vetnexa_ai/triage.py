"""Reliability-weighted evidence fusion and uncertainty-aware triage.

Two pieces of evidence are combined (see the project poster):

1. **Image evidence** – the calibrated class probabilities of the photo.
   * risk = Σ p(class) · CLASS_RISK[class] (the expected urgency of the photo);
   * reliability = quality × familiarity × (0.5 + 0.5 · certainty), where *quality* comes from
     the OpenCV checks, *familiarity* from the out-of-distribution detector and *certainty* is
     1 − normalised entropy of the probabilities.
2. **Symptom evidence** – the rule-weighted risk from the questionnaire (symptoms.py);
   reliability = the share of questions answered.

**Fusion.** ``risk = Σ rᵢ · Riskᵢ / Σ rᵢ`` – more reliable evidence counts for more. The overall
reliability is ``1 − Π(1 − rᵢ)``. Two other modes exist only for the evaluation baselines:
``unweighted`` (every available input counts equally) and ``image_only``.

**Four outcomes.** Routine care / monitor, veterinary consultation recommended, urgent
veterinary attention, or *unable to assess safely* when the overall reliability is too low.

**Safety overrides** (always applied, in this order):

* any red flag → urgent;
* an input that is reliable on its own (r ≥ FLOOR_RELIABILITY) limits how far the other input can
  lower the outcome: "urgent" can drop at most to a consultation, and "see a vet" can never end
  as routine care – missed urgent cases are the most important error to avoid;
* a reliable photo of a cut, puncture or infection always recommends a vet;
* when the evidence is too weak to assess but any input points to urgent care, the result is
  urgent rather than "unable to assess".
"""

from __future__ import annotations

import math

from .config import CLASS_LABELS, SAFETY, QualityThresholds
from .symptoms import questionnaire

#: Expected urgency of each wound class (0 = none, 1 = emergency). Clinical draft values.
CLASS_RISK: dict[str, float] = {
    "healthy_skin": 0.05,
    "abrasion": 0.15,
    "laceration": 0.5,
    "puncture_wound": 0.55,
    "abscess_or_infection": 0.8,
}

OUTCOMES = ("ROUTINE", "CONSULT", "URGENT", "UNABLE")
OUTCOME_LABELS = {
    "ROUTINE": "Routine care – monitor at home",
    "CONSULT": "Veterinary consultation recommended",
    "URGENT": "Urgent veterinary attention",
    "UNABLE": "Unable to assess safely",
}
#: Order of urgency for the three assessable outcomes.
RANK = {"ROUTINE": 0, "CONSULT": 1, "URGENT": 2}
LEVEL_TO_OUTCOME = {"routine": "ROUTINE", "consult": "CONSULT", "urgent": "URGENT"}

#: Below this overall reliability the system abstains ("unable to assess safely").
MIN_RELIABILITY = 0.35
#: An input at least this reliable limits how far the other input can lower the outcome.
FLOOR_RELIABILITY = 0.5
FUSION_MODES = ("reliability", "unweighted", "image_only")


def level_for(risk: float) -> str:
    levels = questionnaire()["levels"]
    if risk >= levels["urgent"]:
        return "URGENT"
    if risk >= levels["consult"]:
        return "CONSULT"
    return "ROUTINE"


def quality_score(report: dict, limits: QualityThresholds) -> float:
    """0–1 score from the OpenCV measures (1 = sharp, well exposed, little clipping)."""
    sharp = math.log(max(report["sharpness"], 1) / (limits.min_sharpness / 2)) / math.log(8)
    brightness = report["brightness"]
    if brightness < 70:
        bright = (brightness - limits.min_brightness) / (70 - limits.min_brightness)
    elif brightness > 190:
        bright = (limits.max_brightness - brightness) / (limits.max_brightness - 190)
    else:
        bright = 1.0
    clipped = 1 - report["clippedFraction"] / limits.max_clipped_fraction
    return round(max(0.0, min(1.0, sharp, bright, clipped)), 4)


def image_evidence(
    probabilities: dict[str, float], quality: float, familiarity: float | None
) -> dict:
    """Risk and reliability of the photo. ``familiarity`` is None when no OOD detector exists."""
    risk = sum(p * CLASS_RISK[name] for name, p in probabilities.items())
    entropy = -sum(p * math.log(p) for p in probabilities.values() if p > 0)
    certainty = 1 - entropy / math.log(len(probabilities))
    familiar = 1.0 if familiarity is None else familiarity
    unfamiliar = familiarity is not None and familiarity < 0.5
    reliability = 0.0 if unfamiliar else quality * familiar * (0.5 + 0.5 * certainty)
    top = max(probabilities, key=probabilities.get)

    notes = []
    if unfamiliar:
        notes.append(
            "The photo does not look like the wound photos the model knows, so it was not used."
        )
    elif familiarity is None:
        notes.append("The unfamiliar-photo check is not available for this model.")
    if quality < 0.6:
        notes.append("The photo quality is only fair, so it counts for less.")
    if certainty < 0.5:
        notes.append("The model is unsure between several wound types.")
    return {
        "source": "image",
        "risk": round(risk, 4),
        "level": level_for(risk),
        "reliability": round(reliability, 4),
        "quality": round(quality, 4),
        "familiarity": None if familiarity is None else round(familiarity, 4),
        "certainty": round(certainty, 4),
        "topClass": top,
        "notes": notes,
    }


def symptom_input(evidence: dict) -> dict:
    notes = []
    if evidence["missing"]:
        notes.append(
            f"{len(evidence['missing'])} question(s) were answered 'Not sure', so the answers "
            "count for less."
        )
    return {
        "source": "symptoms",
        "risk": evidence["risk"],
        "level": LEVEL_TO_OUTCOME[evidence["level"]] if not evidence["redFlags"] else "URGENT",
        "reliability": evidence["completeness"],
        "notes": notes,
    }


def fuse(image: dict | None, symptoms: dict | None, mode: str = "reliability") -> dict:
    """Combines the evidence into one of four outcomes, with an explanation."""
    if mode not in FUSION_MODES:
        raise ValueError(f"mode must be one of {FUSION_MODES}")
    inputs = [i for i in (image, symptom_input(symptoms) if symptoms else None) if i]
    if mode == "image_only":
        inputs = [i for i in inputs if i["source"] == "image"]

    weights = {i["source"]: (i["reliability"] if mode == "reliability" else 1.0) for i in inputs}
    total = sum(weights.values())
    fused = sum(weights[i["source"]] * i["risk"] for i in inputs) / total if total > 0 else None
    overall = 1 - math.prod(1 - i["reliability"] for i in inputs) if inputs else 0.0
    for i in inputs:
        i["weight"] = round(weights[i["source"]] / total, 4) if total > 0 else 0.0

    overrides: list[str] = []
    red_flags = bool(symptoms and symptoms["redFlags"]) and mode != "image_only"
    if red_flags:
        outcome = "URGENT"
        overrides.append("Emergency signs were reported, so the result is urgent.")
    elif fused is None or (mode == "reliability" and overall < MIN_RELIABILITY):
        outcome = "UNABLE"
        if any(i["level"] == "URGENT" for i in inputs):
            outcome = "URGENT"
            overrides.append(
                "The evidence is too weak to assess, but part of it points to urgent care, so the "
                "result is urgent to be safe."
            )
    else:
        outcome = level_for(fused)
        for i in inputs:
            # Urgent may become a consultation; a consultation never becomes routine.
            floor = max(RANK[i["level"]] - 1, min(RANK[i["level"]], 1))
            if i["reliability"] >= FLOOR_RELIABILITY and RANK[outcome] < floor:
                outcome = OUTCOMES[floor]
                name = "photo" if i["source"] == "image" else "symptoms you described"
                overrides.append(
                    f"The {name} suggested a higher urgency, so the result was raised to be safe."
                )
        if (
            image
            and image["reliability"] >= FLOOR_RELIABILITY
            and image["topClass"] in SAFETY.always_refer
            and RANK[outcome] < RANK["CONSULT"]
        ):
            outcome = "CONSULT"
            overrides.append(
                f"Photos showing {CLASS_LABELS[image['topClass']]} always need a veterinarian."
            )

    return {
        "outcome": outcome,
        "label": OUTCOME_LABELS[outcome],
        "combinedRisk": None if fused is None else round(fused, 4),
        "reliability": round(overall, 4),
        "inputs": inputs,
        "overrides": overrides,
        "fusion": mode,
    }
