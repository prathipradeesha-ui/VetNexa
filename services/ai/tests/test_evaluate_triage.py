"""Tests for the triage evaluation (evaluate_triage.py)."""

import random

import numpy as np
import pytest

from vetnexa_ai.evaluate_triage import (
    SIMULATED_ANSWERS,
    TRUE_OUTCOME,
    degrade,
    ood_metrics,
    reliability_diagram,
    risk_coverage,
    simulate_answers,
    triage_metrics,
    unfamiliar_images,
)
from vetnexa_ai.quality import check_quality
from vetnexa_ai.symptoms import evaluate_symptoms, parse_answers
from vetnexa_ai.synthetic import draw


def test_every_wound_type_has_a_simulation_and_a_ground_truth():
    assert set(SIMULATED_ANSWERS) == set(TRUE_OUTCOME)
    assert set(TRUE_OUTCOME.values()) == {"ROUTINE", "CONSULT", "URGENT"}


def test_simulated_answers_are_valid_repeatable_and_follow_the_wound_type():
    a = simulate_answers("abscess_or_infection", 0.0, 0.0, random.Random(1))
    b = simulate_answers("abscess_or_infection", 0.0, 0.0, random.Random(1))
    assert a == b
    evidence = evaluate_symptoms(parse_answers(a))  # raises if any answer is invalid
    assert evidence["level"] == "urgent"
    healthy = evaluate_symptoms(
        parse_answers(simulate_answers("healthy_skin", 0, 0, random.Random(1)))
    )
    assert healthy["level"] == "routine"


def test_sparse_answers_leave_questions_unanswered():
    answers = simulate_answers("laceration", 0.0, 1.0, random.Random(3))
    assert evaluate_symptoms(parse_answers(answers))["completeness"] == 0


def test_triage_metrics_count_safety_errors():
    truth = ["URGENT", "URGENT", "CONSULT", "ROUTINE"]
    predicted = ["URGENT", "ROUTINE", "UNABLE", "CONSULT"]
    m = triage_metrics(truth, predicted, [0.9, 0.8, 0.1, 0.7])
    assert m["urgent_sensitivity"] == 0.5
    assert m["needs_vet_shown_routine"] == pytest.approx(1 / 3, abs=1e-3)
    assert m["coverage"] == 0.75
    assert m["under_triage"] == pytest.approx(1 / 3, abs=1e-3)  # of the 3 assessed
    assert m["over_triage"] == pytest.approx(1 / 3, abs=1e-3)


def test_risk_coverage_answers_the_most_reliable_cases_first():
    truth = np.array(["ROUTINE"] * 4)
    predicted = np.array(["ROUTINE", "ROUTINE", "CONSULT", "CONSULT"])
    curve, aurc = risk_coverage(truth, predicted, np.array([0.9, 0.8, 0.2, 0.1]))
    assert curve[0] == {"coverage": 0.25, "risk": 0.0}
    assert curve[-1] == {"coverage": 1.0, "risk": 0.5}
    assert aurc == pytest.approx((0 + 0 + 1 / 3 + 0.5) / 4, abs=1e-3)


def test_ood_metrics_separate_familiar_from_unfamiliar():
    m = ood_metrics([0.9, 0.8, 0.95, 0.7], [0.1, 0.2, 0.05])
    assert m["auroc"] == 1.0
    assert m["fpr_at_95_tpr"] == 0.0
    assert m["flagged_unfamiliar"] == 1.0
    assert ood_metrics([], [0.1]) is None


def test_unfamiliar_images_and_degraded_photos_are_usable_test_inputs():
    images = unfamiliar_images(8, seed=1)
    assert len(images) == 8 and images[0].shape == (320, 320, 3)
    photo = draw("laceration", np.random.default_rng(2))
    darker = degrade(photo)
    assert darker.mean() < photo.mean()
    assert check_quality(darker).brightness < check_quality(photo).brightness


def test_reliability_diagram_bins_confidence():
    probs = np.array([[0.95, 0.05], [0.9, 0.1], [0.55, 0.45]])
    bins = reliability_diagram(probs, np.array([0, 1, 0]))
    assert sum(b["count"] for b in bins) == 3
    # Bins include their upper edge, as in the ECE: 0.95 is in (0.9, 1.0], 0.9 in (0.8, 0.9].
    by_start = {b["from"]: b for b in bins}
    assert by_start[0.9]["accuracy"] == 1.0
    assert by_start[0.8]["accuracy"] == 0.0
