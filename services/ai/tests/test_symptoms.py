"""Tests for the symptom questionnaire, its rules and how they combine with the image result."""

import json

import numpy as np
import pytest
from fastapi.testclient import TestClient

from vetnexa_ai.assessment import Assessor
from vetnexa_ai.config import CLASSES
from vetnexa_ai.model import build_model
from vetnexa_ai.service import create_app
from vetnexa_ai.symptoms import (
    InvalidAnswersError,
    evaluate_symptoms,
    parse_answers,
    questionnaire,
)

from .conftest import encode

COMPLETE = {
    "species": "dog",
    "redFlags": [],
    "bodyLocation": "paw",
    "duration": "under_24h",
    "cause": "sharp_object",
    "signs": ["open_wound"],
    "appetite": "normal",
    "energy": "normal",
    "pain": "mild",
}


def evidence(**changes):
    return evaluate_symptoms(parse_answers({**COMPLETE, **changes}))


# ── Questionnaire file ──


def test_questionnaire_is_consistent():
    q = questionnaire()
    question_ids = {question["id"] for question in q["questions"]}
    options = {
        question["id"]: {o["id"] for o in question["options"]} for question in q["questions"]
    }
    for rule in q["rules"]:
        assert 0 < rule["weight"] < 1, rule["id"]
        assert rule["reason"], rule["id"]
        for key, value in rule["when"].items():
            assert key in question_ids, rule["id"]
            for option in value if isinstance(value, list) else [value]:
                assert option in options[key], (rule["id"], option)
    assert 0 < q["levels"]["consult"] < q["levels"]["urgent"] < 1


# ── Parsing ──


def test_invalid_answers_are_rejected():
    for bad in [
        {**COMPLETE, "species": "rabbit"},
        {**COMPLETE, "redFlags": ["not_a_flag"]},
        {**COMPLETE, "duration": "forever"},
        {**COMPLETE, "signs": "pus"},
        {**COMPLETE, "signs": ["pus", "glitter"]},
    ]:
        with pytest.raises(InvalidAnswersError):
            parse_answers(bad)


# ── Rules ──


def test_small_fresh_cut_is_routine():
    result = evidence()
    assert result["level"] == "routine"
    assert result["completeness"] == 1
    assert result["missing"] == []
    assert {r["id"] for r in result["rules"]} == {"open_wound", "mild_pain"}


def test_bite_with_swelling_and_pus_is_urgent():
    result = evidence(cause="bite_fight", signs=["swelling", "pus"])
    # noisy-OR with mild pain from the base answers: 1 - 0.65 * 0.65 * 0.85 * 0.95 = 0.6588
    assert result["risk"] == pytest.approx(0.6588, abs=1e-3)
    assert result["level"] == "urgent"
    assert result["rules"][0]["weight"] >= result["rules"][-1]["weight"]


def test_eye_area_needs_a_vet_even_without_other_signs():
    assert evidence(bodyLocation="eye_area", signs=[], pain="none")["level"] == "consult"


def test_rule_with_two_conditions_needs_both():
    ids = {r["id"] for r in evidence(bodyLocation="belly")["rules"]}
    assert "open_wound_body" in ids
    ids = {r["id"] for r in evidence(bodyLocation="belly", signs=["swelling"])["rules"]}
    assert "open_wound_body" not in ids


def test_more_evidence_never_lowers_risk():
    base = evidence(signs=["swelling"])["risk"]
    assert evidence(signs=["swelling", "bad_smell"])["risk"] > base


def test_red_flag_is_always_urgent():
    result = evidence(redFlags=["heavy_bleeding"], signs=[], pain="none")
    assert result["level"] == "urgent"
    assert result["redFlags"][0]["id"] == "heavy_bleeding"


def test_unanswered_questions_are_missing_inputs():
    result = evaluate_symptoms(parse_answers({"species": "cat", "duration": "1_3_days"}))
    assert result["completeness"] == pytest.approx(1 / 7, abs=1e-3)
    assert "bodyLocation" in result["missing"] and "signs" in result["missing"]
    assert result["level"] == "routine"


# ── Service ──


@pytest.fixture(scope="module")
def client():
    model = build_model(len(CLASSES), pretrained=False).eval()
    return TestClient(create_app(Assessor(model, list(CLASSES), 1.0, "test", demo=True)))


def test_service_accepts_photo_and_answers(client, good_image):
    response = client.post(
        "/assess",
        files={"image": ("wound.jpg", encode(good_image), "image/jpeg")},
        data={"answers": json.dumps({**COMPLETE, "cause": "bite_fight"})},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["symptoms"]["rules"][0]["id"] == "bite"
    assert body["severity"] != "MINOR"  # a bite is at least a vet consultation


def test_poor_photo_with_red_flag_is_still_urgent(client):
    dark = np.full((320, 320, 3), 5, dtype=np.uint8)
    body = client.post(
        "/assess",
        files={"image": ("dark.jpg", encode(dark), "image/jpeg")},
        data={"answers": json.dumps({**COMPLETE, "redFlags": ["collapse"]})},
    ).json()
    assert body["triage"]["outcome"] == "URGENT"
    assert body["severity"] == "SEVERE" and body["referToVet"]


def test_poor_photo_without_red_flags_is_rejected(client):
    dark = np.full((320, 320, 3), 5, dtype=np.uint8)
    body = client.post(
        "/assess",
        files={"image": ("dark.jpg", encode(dark), "image/jpeg")},
        data={"answers": json.dumps(COMPLETE)},
    ).json()
    assert body["status"] == "REJECTED_QUALITY"
    assert body["symptoms"]["level"] == "routine"


def test_service_rejects_invalid_answers(client, good_image):
    response = client.post(
        "/assess",
        files={"image": ("wound.jpg", encode(good_image), "image/jpeg")},
        data={"answers": json.dumps({**COMPLETE, "species": "bird"})},
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "INVALID_ANSWERS"
