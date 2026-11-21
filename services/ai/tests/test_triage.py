"""Tests for reliability-weighted fusion and uncertainty-aware triage (triage.py)."""

import json

import numpy as np
import pytest
import torch
from fastapi.testclient import TestClient

from vetnexa_ai.assessment import Assessor
from vetnexa_ai.config import CLASSES, QUALITY
from vetnexa_ai.model import build_model
from vetnexa_ai.ood import OODDetector
from vetnexa_ai.service import create_app
from vetnexa_ai.symptoms import evaluate_symptoms, parse_answers
from vetnexa_ai.triage import fuse, image_evidence, quality_score

from .conftest import encode

GOOD_QUALITY = {"sharpness": 400.0, "brightness": 120.0, "clippedFraction": 0.0}


def probs(**values):
    base = dict.fromkeys(CLASSES, 0.0)
    rest = (1 - sum(values.values())) / (len(CLASSES) - len(values))
    return {name: values.get(name, rest) for name in base}


def image(p, quality=1.0, familiarity=0.9):
    return image_evidence(p, quality, familiarity)


def symptoms(**answers):
    complete = {
        "species": "dog",
        "redFlags": [],
        "bodyLocation": "paw",
        "duration": "under_24h",
        "cause": "none_noticed",
        "signs": [],
        "appetite": "normal",
        "energy": "normal",
        "pain": "none",
    }
    return evaluate_symptoms(parse_answers({**complete, **answers}))


# ── Inputs ──


def test_quality_score_rewards_sharp_well_exposed_photos():
    assert quality_score(GOOD_QUALITY, QUALITY) == 1.0
    blurry = quality_score({**GOOD_QUALITY, "sharpness": 70.0}, QUALITY)
    dim = quality_score({**GOOD_QUALITY, "brightness": 50.0}, QUALITY)
    assert 0 < blurry < 0.6 and 0 < dim < 0.6


def test_image_risk_is_the_expected_class_risk():
    ev = image(probs(abscess_or_infection=0.9))
    assert ev["risk"] > 0.7 and ev["level"] == "URGENT" and ev["topClass"] == "abscess_or_infection"
    assert image(probs(healthy_skin=0.95))["level"] == "ROUTINE"


def test_unsure_or_poor_photos_count_for_less():
    confident = image(probs(abrasion=0.95))["reliability"]
    unsure = image({name: 1 / len(CLASSES) for name in CLASSES})["reliability"]
    poor = image(probs(abrasion=0.95), quality=0.4)["reliability"]
    assert confident > unsure and confident > poor


def test_unfamiliar_photo_is_excluded():
    ev = image(probs(abrasion=0.95), familiarity=0.2)
    assert ev["reliability"] == 0
    assert "does not look like the wound photos" in ev["notes"][0]


# ── Fusion ──


def test_reliable_inputs_are_weighted_by_reliability():
    img = image(probs(healthy_skin=0.95))
    sym = symptoms()
    result = fuse(img, sym)
    weights = {i["source"]: i["weight"] for i in result["inputs"]}
    assert weights["symptoms"] > weights["image"]  # complete answers vs a ~0.9 reliable photo
    assert result["outcome"] == "ROUTINE"
    assert result["reliability"] > 0.9


def test_fused_risk_lies_between_the_inputs_and_urgent_never_drops_below_consult():
    img = image(probs(laceration=0.9))  # a cut: consultation
    sym = symptoms(cause="bite_fight", signs=["swelling", "pus"])  # urgent on its own
    result = fuse(img, sym)
    risks = sorted(i["risk"] for i in result["inputs"])
    assert risks[0] <= result["combinedRisk"] <= risks[1]
    assert result["outcome"] in {"CONSULT", "URGENT"}
    assert fuse(image(probs(healthy_skin=0.97)), sym)["outcome"] != "ROUTINE"


def test_red_flags_always_mean_urgent():
    result = fuse(image(probs(healthy_skin=0.97)), symptoms(redFlags=["collapse"]))
    assert result["outcome"] == "URGENT"
    assert "Emergency signs" in result["overrides"][0]


def test_a_reliable_vet_recommendation_is_never_turned_into_routine():
    # Photo looks fine, but complete answers point to a consultation (bite).
    result = fuse(image(probs(healthy_skin=0.97)), symptoms(cause="bite_fight"))
    assert result["outcome"] == "CONSULT"
    assert result["overrides"]


def test_reliable_cut_photo_always_refers_even_with_reassuring_answers():
    result = fuse(image(probs(laceration=0.9)), symptoms())
    assert result["outcome"] in {"CONSULT", "URGENT"}


def test_abstains_when_the_evidence_is_too_weak():
    unsure = {name: 1 / len(CLASSES) for name in CLASSES}
    result = fuse(image(unsure, quality=0.3, familiarity=0.6), None)
    assert result["outcome"] == "UNABLE"
    assert result["label"] == "Unable to assess safely"


def test_weak_evidence_pointing_to_urgency_is_urgent_not_unable():
    weak_answers = evaluate_symptoms(
        parse_answers({"species": "cat", "energy": "very_low", "appetite": "not_eating"})
    )
    result = fuse(image(probs(healthy_skin=0.9), familiarity=0.1), weak_answers)
    assert result["outcome"] == "URGENT"


def test_unfamiliar_photo_leaves_the_decision_to_the_answers():
    result = fuse(image(probs(healthy_skin=0.97), familiarity=0.1), symptoms(cause="bite_fight"))
    image_input = next(i for i in result["inputs"] if i["source"] == "image")
    assert image_input["weight"] == 0
    assert result["outcome"] == "CONSULT"


def test_baseline_modes_for_the_evaluation():
    img = image(probs(healthy_skin=0.97))
    sym = symptoms(cause="bite_fight", signs=["swelling"])
    assert fuse(img, sym, "image_only")["inputs"][0]["source"] == "image"
    assert len(fuse(img, sym, "image_only")["inputs"]) == 1
    unweighted = fuse(img, sym, "unweighted")
    assert all(i["weight"] == 0.5 for i in unweighted["inputs"])
    with pytest.raises(ValueError):
        fuse(img, sym, "magic")


# ── Assessor and service ──


@pytest.fixture(scope="module")
def assessor_with_ood():
    model = build_model(len(CLASSES), pretrained=False).eval()
    dim = model.feature_dim
    detector = OODDetector(
        class_means=torch.zeros(len(CLASSES), dim),
        precision=torch.eye(dim),
        temperature=1.0,
        energy_threshold=1e6,  # energy never flags in this test
        energy_scale=1.0,
        distance_threshold=1e9,  # every real photo counts as familiar
        distance_scale=1.0,
    )
    return Assessor(model, list(CLASSES), 1.0, "test", demo=True, ood=detector)


def test_assessor_returns_a_triage_with_explanation(assessor_with_ood, good_image):
    answers = parse_answers(
        {"species": "dog", "redFlags": [], "cause": "bite_fight", "signs": ["swelling"]}
    )
    result = assessor_with_ood.assess(encode(good_image), answers)
    triage = result["triage"]
    assert triage["outcome"] in {"ROUTINE", "CONSULT", "URGENT", "UNABLE"}
    assert {i["source"] for i in triage["inputs"]} == {"image", "symptoms"}
    assert result["ood"]["outOfDistribution"] is False
    assert result["severity"] in {"MINOR", "MODERATE", "SEVERE", "UNCERTAIN"}
    assert result["referToVet"] == (triage["outcome"] != "ROUTINE")


def test_service_returns_triage(assessor_with_ood, good_image):
    client = TestClient(create_app(assessor_with_ood))
    body = client.post(
        "/assess",
        files={"image": ("w.jpg", encode(good_image), "image/jpeg")},
        data={"answers": json.dumps({"species": "cat", "redFlags": ["seizure"]})},
    ).json()
    assert body["triage"]["outcome"] == "URGENT"
    assert body["severity"] == "SEVERE"


def test_poor_photo_with_red_flag_gets_urgent_triage(assessor_with_ood):
    dark = np.full((320, 320, 3), 5, dtype=np.uint8)
    answers = parse_answers({"species": "dog", "redFlags": ["heavy_bleeding"]})
    result = assessor_with_ood.assess(encode(dark), answers)
    assert result["status"] == "ASSESSED"
    assert result["triage"]["outcome"] == "URGENT"
    assert result["referToVet"]
