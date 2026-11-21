"""Symptom and context evidence: the second input of the multimodal assessment.

The owner answers a short questionnaire (`questionnaire.json`) about the problem: where it is,
how long it has been there, what caused it, what they see, and how the pet is eating, moving
and coping with pain. This module turns those answers into transparent evidence:

* **Red flags** – emergencies such as heavy bleeding or breathing difficulty. Any red flag
  means urgent veterinary attention, whatever the photo shows (a safety override).
* **Rule-weighted risk** – each documented rule that applies adds its weight. Weights combine
  as a noisy-OR, ``risk = 1 − Π(1 − wᵢ)``, so the score stays between 0 and 1, more evidence
  always raises it, and every rule's contribution can be shown to the owner.
* **Completeness** – the share of questions answered. Unanswered questions ("not sure") are
  listed as missing inputs and lower how much this evidence can be relied on.

All weights and thresholds live in ``questionnaire.json`` so a veterinarian can review them
without reading code.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from functools import cache
from pathlib import Path

QUESTIONNAIRE_PATH = Path(__file__).with_name("questionnaire.json")
SPECIES = ("dog", "cat")
LEVELS = ("routine", "consult", "urgent")


class InvalidAnswersError(ValueError):
    """The answers do not match the questionnaire."""


@cache
def questionnaire() -> dict:
    return json.loads(QUESTIONNAIRE_PATH.read_text(encoding="utf-8"))


@dataclass(frozen=True)
class Answers:
    """Validated questionnaire answers. ``None`` means "not sure" / not answered."""

    species: str
    red_flags: tuple[str, ...] = ()
    single: dict[str, str | None] = field(default_factory=dict)
    signs: tuple[str, ...] | None = None


def parse_answers(raw: dict) -> Answers:
    """Checks raw answers (from the API) against the questionnaire."""
    if not isinstance(raw, dict):
        raise InvalidAnswersError("Answers must be an object.")
    q = questionnaire()
    species = str(raw.get("species", "")).lower()
    if species not in SPECIES:
        raise InvalidAnswersError("species must be dog or cat")

    flag_ids = {f["id"] for f in q["redFlags"]}
    red_flags = raw.get("redFlags") or []
    if not isinstance(red_flags, list) or any(f not in flag_ids for f in red_flags):
        raise InvalidAnswersError("Unknown red flag.")

    single: dict[str, str | None] = {}
    signs: tuple[str, ...] | None = None
    for question in q["questions"]:
        allowed = {o["id"] for o in question["options"]}
        value = raw.get(question["id"])
        if question["type"] == "multiple":
            if value is None:
                continue
            if not isinstance(value, list) or any(v not in allowed for v in value):
                raise InvalidAnswersError(f"Invalid answer for {question['id']}.")
            signs = tuple(dict.fromkeys(value))
        else:
            if value is not None and value not in allowed:
                raise InvalidAnswersError(f"Invalid answer for {question['id']}.")
            single[question["id"]] = value
    return Answers(species, tuple(dict.fromkeys(red_flags)), single, signs)


def _matches(answers: Answers, key: str, expected: str | list[str]) -> bool:
    options = expected if isinstance(expected, list) else [expected]
    if key == "signs":
        return answers.signs is not None and any(o in answers.signs for o in options)
    return answers.single.get(key) in options


def evaluate_symptoms(answers: Answers) -> dict:
    """Turns answers into red flags, triggered rules, a risk score, level and completeness."""
    q = questionnaire()
    flag_labels = {f["id"]: f["label"] for f in q["redFlags"]}

    triggered = []
    remaining = 1.0
    for rule in q["rules"]:
        if all(_matches(answers, key, value) for key, value in rule["when"].items()):
            triggered.append({"id": rule["id"], "weight": rule["weight"], "reason": rule["reason"]})
            remaining *= 1 - rule["weight"]
    risk = 1 - remaining

    missing = [
        question["id"]
        for question in q["questions"]
        if (
            answers.signs is None
            if question["type"] == "multiple"
            else answers.single.get(question["id"]) is None
        )
    ]
    completeness = 1 - len(missing) / len(q["questions"])

    if answers.red_flags or risk >= q["levels"]["urgent"]:
        level = "urgent"
    elif risk >= q["levels"]["consult"]:
        level = "consult"
    else:
        level = "routine"

    return {
        "species": answers.species,
        "redFlags": [{"id": f, "label": flag_labels[f]} for f in answers.red_flags],
        "risk": round(risk, 4),
        "level": level,
        "rules": sorted(triggered, key=lambda r: r["weight"], reverse=True),
        "completeness": round(completeness, 4),
        "missing": missing,
        "questionnaireVersion": q["version"],
    }
