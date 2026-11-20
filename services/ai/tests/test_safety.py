"""The safety rules decide what an owner is told, so each rule has its own test."""

from vetnexa_ai.assessment import apply_safety_rules
from vetnexa_ai.config import CLASSES


def probs(**values: float) -> dict[str, float]:
    """Probabilities for every class; unspecified classes share what is left."""
    rest = [c for c in CLASSES if c not in values]
    remaining = max(0.0, 1 - sum(values.values()))
    return {**values, **{c: remaining / len(rest) for c in rest}}


def test_confident_minor_wound_is_minor_without_referral():
    result = apply_safety_rules(probs(abrasion=0.92))
    assert result["status"] == "ASSESSED"
    assert result["severity"] == "MINOR"
    assert result["referToVet"] is False
    assert "abrasion" in result["summary"]


def test_low_confidence_gives_uncertain_and_refers_to_a_vet():
    result = apply_safety_rules(probs(laceration=0.45, abrasion=0.40))
    assert result["status"] == "UNCERTAIN"
    assert result["severity"] == "UNCERTAIN"
    assert result["referToVet"] is True


def test_severity_is_raised_when_a_serious_class_is_still_likely():
    # Most likely an abrasion, but infection is 28% likely: treat it as severe to be safe.
    result = apply_safety_rules(probs(abrasion=0.65, abscess_or_infection=0.28))
    assert result["severity"] == "SEVERE"
    assert result["escalated"] is True
    assert result["referToVet"] is True
    assert "raised" in result["guidance"]


def test_small_chance_of_a_serious_class_does_not_escalate():
    result = apply_safety_rules(probs(abrasion=0.85, abscess_or_infection=0.10))
    assert result["severity"] == "MINOR"
    assert result["escalated"] is False


def test_cuts_punctures_and_infections_always_recommend_a_vet():
    for name in ("laceration", "puncture_wound", "abscess_or_infection"):
        assert apply_safety_rules(probs(**{name: 0.95}))["referToVet"] is True


def test_never_uses_the_word_diagnosis_in_owner_text():
    for name in CLASSES:
        result = apply_safety_rules(probs(**{name: 0.9}))
        assert "diagnos" not in (result["summary"] + result["guidance"]).lower()
