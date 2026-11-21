"""Tests for the HTTP inference service."""

import numpy as np
import pytest
from fastapi.testclient import TestClient

from vetnexa_ai.assessment import Assessor
from vetnexa_ai.config import CLASSES, DISCLAIMER
from vetnexa_ai.model import build_model
from vetnexa_ai.service import create_app

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
