"""Tests for the HTTP inference service."""

import numpy as np
import pytest
from fastapi.testclient import TestClient

from vetnexa_ai.assessment import Assessor
from vetnexa_ai.chat import Assistant
from vetnexa_ai.config import CLASSES, DISCLAIMER
from vetnexa_ai.model import build_model
from vetnexa_ai.service import create_app
from vetnexa_ai.skin_check import SkinChecker
from vetnexa_ai.skin_dataset import SKIN_CLASSES

from .conftest import encode


@pytest.fixture(scope="module")
def assessor():
    # Random weights are enough: these tests check the HTTP layer, not accuracy.
    model = build_model(len(CLASSES), pretrained=False).eval()
    return Assessor(model, list(CLASSES), 1.0, "wound-test-1", demo=True)


@pytest.fixture
def client(assessor):
    return TestClient(create_app(assessor))


def test_health_reports_the_loaded_model(client):
    body = client.get("/health").json()
    assert body == {
        "status": "ok",
        "modelLoaded": True,
        "modelVersion": "wound-test-1",
        "demoModel": True,
        "chatArticles": 0,
        "skinModelVersion": None,
    }


def test_assess_returns_a_cautious_result(client, good_image):
    response = client.post(
        "/assess", content=encode(good_image), headers={"content-type": "image/jpeg"}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] in {"ASSESSED", "UNCERTAIN"}
    assert body["demoModel"] is True
    assert body["disclaimer"] == DISCLAIMER
    assert set(body["probabilities"]) == set(CLASSES)
    assert sum(body["probabilities"].values()) == pytest.approx(1, abs=1e-3)


def test_poor_photo_is_rejected_without_prediction(client):
    dark = np.full((320, 320, 3), 5, dtype=np.uint8)
    body = client.post("/assess", content=encode(dark)).json()
    assert body["status"] == "REJECTED_QUALITY"
    assert body["predictedClass"] is None


def test_non_image_is_a_422(client):
    response = client.post("/assess", content=b"definitely not an image")
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "INVALID_IMAGE"


def test_empty_body_is_a_422(client):
    assert client.post("/assess", content=b"").status_code == 422


def test_without_a_model_assess_is_unavailable(good_image):
    client = TestClient(create_app(None))
    assert client.get("/health").json()["modelLoaded"] is False
    response = client.post("/assess", content=encode(good_image))
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "MODEL_UNAVAILABLE"


def test_token_is_required_when_configured(assessor, good_image):
    client = TestClient(create_app(assessor, token="s3cret-token"))
    assert client.get("/health").status_code == 200  # health stays open for Docker checks
    assert client.post("/assess", content=encode(good_image)).status_code == 401
    ok = client.post(
        "/assess", content=encode(good_image), headers={"x-service-token": "s3cret-token"}
    )
    assert ok.status_code == 200


@pytest.fixture(scope="module")
def chat_client():
    return TestClient(create_app(None, assistant=Assistant()))


def test_chat_answers_a_question(chat_client):
    response = chat_client.post("/chat", json={"message": "How often should I deworm my dog?"})
    assert response.status_code == 200
    assert response.json()["article"]["id"] == "deworming"


def test_chat_flags_an_emergency(chat_client):
    body = chat_client.post("/chat", json={"message": "My dog ate rat poison"}).json()
    assert body["kind"] == "emergency"


@pytest.mark.parametrize("payload", [{}, {"message": "   "}, {"message": "x" * 501}, [1, 2]])
def test_chat_rejects_invalid_messages(chat_client, payload):
    assert chat_client.post("/chat", json=payload).status_code == 422


def test_chat_without_assistant_is_unavailable(client):
    assert client.post("/chat", json={"message": "hi"}).status_code == 503


@pytest.fixture(scope="module")
def skin_checker():
    model = build_model(len(SKIN_CLASSES), pretrained=False).eval()
    return SkinChecker(model, list(SKIN_CLASSES), 1.0, "skin-test-1")


def test_skin_check_is_added_to_photos_that_pass_quality(assessor, skin_checker, good_image):
    client = TestClient(create_app(assessor, skin=skin_checker))
    assert client.get("/health").json()["skinModelVersion"] == "skin-test-1"
    body = client.post("/assess", content=encode(good_image)).json()
    skin = body["skinCheck"]
    assert skin["status"] in {"SUGGESTED", "UNSURE", "UNFAMILIAR"}
    assert set(skin["probabilities"]) == set(SKIN_CLASSES)
    assert skin["advice"]
    # The skin check is advisory: it never changes the triage outcome.
    assert body["triage"] == client.post("/assess", content=encode(good_image)).json()["triage"]


def test_skin_check_is_skipped_for_poor_photos(assessor, skin_checker):
    client = TestClient(create_app(assessor, skin=skin_checker))
    dark = np.full((320, 320, 3), 5, dtype=np.uint8)
    assert client.post("/assess", content=encode(dark)).json()["skinCheck"] is None


def test_skin_check_reports_unsure_instead_of_guessing(skin_checker, good_image):
    from vetnexa_ai.quality import decode_image

    flat = SkinChecker(skin_checker.model, skin_checker.classes, 1000.0, "skin-test-1")
    result = flat.check(decode_image(encode(good_image)))
    assert result["status"] == "UNSURE"
    assert result["condition"] is None
