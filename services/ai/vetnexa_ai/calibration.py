"""Confidence calibration.

Neural networks are often over-confident: a model may say "95%" when it is right only 80% of
the time. Because VetNexa shows the confidence to pet owners, the number must be honest.
Temperature scaling divides the model's raw scores by one number T, chosen on the validation
set, so that stated confidence matches actual accuracy. It does not change which class wins.

Safety choice: T is never allowed below 1, so calibration can only make the model LESS
confident, never more. With a small or very easy validation set the best-fitting T can be
tiny, which would turn a 70% guess into "99% sure" for owners.
"""

from __future__ import annotations

import numpy as np
import torch
from torch import nn

MIN_TEMPERATURE = 1.0
MAX_TEMPERATURE = 10.0


def fit_temperature(logits: torch.Tensor, labels: torch.Tensor) -> float:
    """Finds T that minimises the validation negative log-likelihood, limited to [1, 10]."""
    log_t = torch.zeros(1, requires_grad=True)  # optimise log(T) so T stays positive
    optimizer = torch.optim.LBFGS([log_t], lr=0.1, max_iter=200)
    loss_fn = nn.CrossEntropyLoss()

    def closure():
        optimizer.zero_grad()
        loss = loss_fn(logits / log_t.exp(), labels)
        loss.backward()
        return loss

    optimizer.step(closure)
    return float(log_t.detach().exp().clamp(MIN_TEMPERATURE, MAX_TEMPERATURE))


def expected_calibration_error(probs: np.ndarray, labels: np.ndarray, bins: int = 10) -> float:
    """Average gap between confidence and accuracy, weighted by how many predictions fall in
    each confidence band. 0 means perfectly calibrated."""
    confidence = probs.max(axis=1)
    correct = probs.argmax(axis=1) == labels
    edges = np.linspace(0, 1, bins + 1)
    error = 0.0
    for low, high in zip(edges[:-1], edges[1:], strict=True):
        in_bin = (confidence > low) & (confidence <= high)
        if in_bin.any():
            error += in_bin.mean() * abs(correct[in_bin].mean() - confidence[in_bin].mean())
    return float(error)
