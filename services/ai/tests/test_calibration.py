import numpy as np
import torch

from vetnexa_ai.calibration import expected_calibration_error, fit_temperature


def test_overconfident_model_is_softened():
    torch.manual_seed(0)
    labels = torch.randint(0, 3, (300,))
    logits = torch.randn(300, 3) * 6  # very confident...
    logits[torch.arange(150), labels[:150]] += 8  # ...but only right half the time
    temperature = fit_temperature(logits, labels)
    assert temperature > 1.5


def test_never_makes_the_model_more_confident():
    labels = torch.tensor([0, 1, 2] * 20)
    logits = torch.nn.functional.one_hot(labels, 3).float() * 2  # perfectly separable
    assert fit_temperature(logits, labels) == 1.0


def test_expected_calibration_error():
    labels = np.array([0, 0, 1, 1])
    perfect = np.array([[1.0, 0.0], [1.0, 0.0], [0.0, 1.0], [0.0, 1.0]])
    overconfident = np.array([[0.99, 0.01], [0.99, 0.01], [0.99, 0.01], [0.99, 0.01]])
    assert expected_calibration_error(perfect, labels) == 0
    assert abs(expected_calibration_error(overconfident, labels) - 0.49) < 1e-6
