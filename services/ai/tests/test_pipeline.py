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
    assert result["version"].startswith("wound-efficientnetb0-")
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

    first_backbone_key = next(k for k in saved if k.startswith("backbone."))
    same_classes = build_model(5, pretrained=False)
    load_initial_weights(same_classes, checkpoint)
    state = same_classes.state_dict()
    assert torch.equal(state[first_backbone_key], saved[first_backbone_key])
    assert torch.equal(state["head.1.weight"], saved["head.1.weight"])

    # A model for a different number of classes keeps the backbone but gets a fresh head.
    other_classes = build_model(3, pretrained=False)
    load_initial_weights(other_classes, checkpoint)
    assert torch.equal(other_classes.state_dict()[first_backbone_key], saved[first_backbone_key])
    assert other_classes.state_dict()["head.1.weight"].shape == (3, 1280)


def test_checkpoint_contains_a_fitted_ood_detector(trained):
    import torch

    from vetnexa_ai.ood import OODDetector

    root, _ = trained
    checkpoint = torch.load(root / "models" / "wound-classifier.pt", weights_only=False)
    assert checkpoint["arch"] == "efficientnet_b0"
    detector = OODDetector.from_dict(checkpoint["ood"])
    assert detector.class_means.shape == (5, 1280)
    assert detector.energy_scale > 0 and detector.distance_scale > 0


def test_ood_flags_features_far_from_every_class():
    import torch

    from vetnexa_ai.ood import OODDetector

    detector = OODDetector(
        class_means=torch.zeros(2, 3),
        precision=torch.eye(3),
        temperature=1.0,
        energy_threshold=0.0,
        energy_scale=1.0,
        distance_threshold=9.0,  # three standard deviations
        distance_scale=1.0,
    )
    logits = torch.tensor([[5.0, -5.0], [5.0, -5.0]])  # confident in both cases
    near, far = detector.familiarity(torch.tensor([[0.1, 0.0, 0.0], [10.0, 10.0, 10.0]]), logits)
    assert not near["outOfDistribution"]
    assert far["outOfDistribution"] and far["familiarity"] < 0.01


def test_legacy_resnet_checkpoints_still_load(tmp_path):
    import torch
    from torchvision.models import resnet18

    from vetnexa_ai.model import load_checkpoint

    legacy = resnet18(weights=None)
    legacy.fc = torch.nn.Sequential(torch.nn.Dropout(0.3), torch.nn.Linear(512, 5))
    path = tmp_path / "old.pt"
    torch.save(
        {
            "classes": list("abcde"),
            "temperature": 1.0,
            "version": "old",
            "state_dict": legacy.state_dict(),
        },
        path,
    )
    model, checkpoint = load_checkpoint(path)
    assert checkpoint["arch"] == "resnet18"
    assert model(torch.zeros(1, 3, 224, 224)).shape == (1, 5)
