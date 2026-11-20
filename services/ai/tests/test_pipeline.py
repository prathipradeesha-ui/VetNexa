"""End-to-end smoke test on synthetic images: train → evaluate → assess.

This proves the code works together. The tiny model trained here learns synthetic drawings,
not wounds, so its accuracy says nothing about real-world performance.
"""

import json

import cv2
import numpy as np
import pytest

from vetnexa_ai.assessment import Assessor
from vetnexa_ai.evaluate import evaluate
from vetnexa_ai.synthetic import draw, generate
from vetnexa_ai.train import parse_args, train

from .conftest import encode


@pytest.fixture(scope="module")
def trained(tmp_path_factory):
    root = tmp_path_factory.mktemp("pipeline")
    generate(root / "data", per_class=28)
    args = parse_args(
        [
            "--data-dir",
            str(root / "data"),
            "--output-dir",
            str(root / "models"),
            "--epochs",
            "4",
            "--frozen-epochs",
            "1",
            "--batch-size",
            "16",
            "--no-pretrained",  # no internet needed in tests
            "--cpu",
        ]
    )
    result = train(args)
    return root, result


def test_training_saves_a_calibrated_checkpoint_and_split(trained):
    root, result = trained
    assert (root / "models" / "wound-classifier.pt").exists()
    assert (root / "models" / "split.json").exists()
    assert result["version"].startswith("wound-resnet18-")
    assert result["temperature"] > 0
    assert len(result["history"]) >= 2


def test_evaluation_writes_safety_metrics(trained):
    root, _ = trained
    report = evaluate(
        root / "models" / "wound-classifier.pt", root / "models" / "split.json", root / "reports"
    )
    assert report["test_images"] > 0
    assert set(report["safety"]) >= {"coverage", "under_triage_rate", "accuracy_when_answered"}
    assert len(report["confusion_matrix"]["rows_true_cols_predicted"]) == 5
    saved = json.loads((root / "reports" / "evaluation.json").read_text(encoding="utf-8"))
    assert saved["model_version"] == report["model_version"]
    assert "Confusion matrix" in (root / "reports" / "evaluation.md").read_text(encoding="utf-8")


def test_assessor_returns_a_complete_cautious_result(trained):
    root, _ = trained
    assessor = Assessor.from_checkpoint(root / "models" / "wound-classifier.pt")

    result = assessor.assess(encode(draw("laceration", np.random.default_rng(7))))

    assert result["status"] in {"ASSESSED", "UNCERTAIN"}
    assert abs(sum(result["probabilities"].values()) - 1) < 0.01
    assert result["severity"] in {"MINOR", "MODERATE", "SEVERE", "UNCERTAIN"}
    assert "not a diagnosis" in result["disclaimer"]
    assert result["quality"]["ok"] is True


def test_assessor_refuses_poor_photos_instead_of_guessing(trained):
    root, _ = trained
    assessor = Assessor.from_checkpoint(root / "models" / "wound-classifier.pt")
    blurry = cv2.GaussianBlur(draw("abrasion", np.random.default_rng(3)), (41, 41), 15)

    result = assessor.assess(encode(blurry))

    assert result["status"] == "REJECTED_QUALITY"
    assert result["predictedClass"] is None
    assert "blurry" in result["guidance"]


def test_init_from_copies_matching_weights_and_skips_a_different_head(trained):
    import torch

    from vetnexa_ai.model import build_model
    from vetnexa_ai.train import load_initial_weights

    root, _ = trained
    checkpoint = root / "models" / "wound-classifier.pt"
    saved = torch.load(checkpoint, weights_only=False)["state_dict"]

    same_classes = build_model(5, pretrained=False)
    load_initial_weights(same_classes, checkpoint)
    assert torch.equal(same_classes.state_dict()["conv1.weight"], saved["conv1.weight"])
    assert torch.equal(same_classes.state_dict()["fc.1.weight"], saved["fc.1.weight"])

    # A model for a different number of classes keeps the backbone but gets a fresh head.
    other_classes = build_model(3, pretrained=False)
    load_initial_weights(other_classes, checkpoint)
    assert torch.equal(
        other_classes.state_dict()["layer4.1.conv2.weight"], saved["layer4.1.conv2.weight"]
    )
    assert other_classes.state_dict()["fc.1.weight"].shape == (3, 512)
