"""Generates a small SYNTHETIC image set to test the pipeline without real wound photos.

The images are simple drawings (a skin-coloured background with shapes that differ per class).
They exist only so the code can be tested end to end: loading, splitting, training, calibration,
evaluation and inference. A model trained on them knows nothing about real wounds and must
never be used to assess real photos.

    python -m vetnexa_ai.synthetic --out data/synthetic --per-class 40
"""

from __future__ import annotations

import argparse
from pathlib import Path

import cv2
import numpy as np

from .config import CLASSES


def _skin(rng: np.random.Generator, size: int) -> np.ndarray:
    base = np.array([rng.integers(150, 215), rng.integers(110, 165), rng.integers(90, 140)])
    noise = rng.normal(0, 14, (size, size, 3))
    image = np.clip(base + noise, 0, 255).astype(np.uint8)
    for _ in range(40):  # fur-like strokes give the image real texture (and sharpness)
        x, y = rng.integers(0, size, 2)
        dx, dy = rng.integers(-25, 25, 2)
        shade = tuple(int(c) for c in np.clip(base - rng.integers(20, 60), 0, 255))
        cv2.line(image, (int(x), int(y)), (int(x + dx), int(y + dy)), shade, 1)
    return image


def draw(label: str, rng: np.random.Generator, size: int = 320) -> np.ndarray:
    """One RGB image whose pattern depends on the class."""
    image = _skin(rng, size)
    c = size // 2 + rng.integers(-30, 30, 2)
    if label == "abrasion":
        for _ in range(12):
            offset = rng.integers(-50, 50, 2)
            cv2.line(
                image,
                tuple(map(int, c + offset)),
                tuple(map(int, c + offset + [40, 6])),
                (200, 90, 80),
                2,
            )
    elif label == "laceration":
        angle = rng.uniform(0, np.pi)
        d = np.array([np.cos(angle), np.sin(angle)]) * rng.integers(60, 100)
        cv2.line(image, tuple(map(int, c - d)), tuple(map(int, c + d)), (140, 20, 25), 6)
    elif label == "puncture_wound":
        for _ in range(rng.integers(2, 5)):
            p = c + rng.integers(-35, 35, 2)
            cv2.circle(image, tuple(map(int, p)), int(rng.integers(4, 8)), (90, 10, 15), -1)
    elif label == "abscess_or_infection":
        axes = (int(rng.integers(35, 60)), int(rng.integers(25, 45)))
        cv2.ellipse(
            image, tuple(map(int, c)), axes, float(rng.uniform(0, 180)), 0, 360, (215, 70, 70), -1
        )
        cv2.circle(image, tuple(map(int, c)), int(rng.integers(8, 14)), (235, 225, 150), -1)
    return image


def generate(out: Path, per_class: int, seed: int = 0) -> int:
    rng = np.random.default_rng(seed)
    count = 0
    for label in CLASSES:
        folder = out / label
        folder.mkdir(parents=True, exist_ok=True)
        for i in range(per_class):
            # Every 4 images share a "case" prefix, like several photos of one wound.
            name = f"case{i // 4:03d}__{i % 4}.jpg"
            cv2.imwrite(str(folder / name), cv2.cvtColor(draw(label, rng), cv2.COLOR_RGB2BGR))
            count += 1
    return count


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--out", default="data/synthetic")
    parser.add_argument("--per-class", type=int, default=40)
    args = parser.parse_args()
    print(f"Wrote {generate(Path(args.out), args.per_class)} synthetic images to {args.out}")
