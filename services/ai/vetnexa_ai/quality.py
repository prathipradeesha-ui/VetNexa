"""Image loading and quality checks with OpenCV.

Before the model sees a photo we check that it is a real image and good enough to assess.
A blurry, dark or over-exposed photo is rejected with a clear reason, instead of being
misread by the model. This is one of the main safety measures of the system.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import cv2
import numpy as np

from .config import QUALITY, QualityThresholds


class InvalidImageError(ValueError):
    """The bytes could not be decoded as an image."""


def decode_image(data: bytes) -> np.ndarray:
    """Decodes JPEG/PNG/WebP bytes into an RGB array (height, width, 3).

    Respects the EXIF orientation that phones write, so portrait photos are not sideways.
    """
    buffer = np.frombuffer(data, dtype=np.uint8)
    image = cv2.imdecode(buffer, cv2.IMREAD_COLOR)  # applies EXIF orientation
    if image is None:
        raise InvalidImageError("The file is not a valid image.")
    return cv2.cvtColor(image, cv2.COLOR_BGR2RGB)


def sharpness(gray: np.ndarray) -> float:
    """Variance of the Laplacian: a standard measure of focus. Low values mean blur."""
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


@dataclass
class QualityReport:
    ok: bool
    width: int
    height: int
    sharpness: float
    brightness: float
    clipped_fraction: float
    problems: list[str] = field(default_factory=list)

    def as_dict(self) -> dict:
        return {
            "ok": self.ok,
            "width": self.width,
            "height": self.height,
            "sharpness": round(self.sharpness, 1),
            "brightness": round(self.brightness, 1),
            "clippedFraction": round(self.clipped_fraction, 3),
            "problems": self.problems,
        }


def check_quality(image: np.ndarray, limits: QualityThresholds = QUALITY) -> QualityReport:
    """Measures size, focus and exposure and explains any problem in plain language."""
    height, width = image.shape[:2]
    # Measure on a resized copy so the result does not depend on camera resolution.
    scale = 512 / max(height, width)
    small = (
        cv2.resize(image, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
        if scale < 1
        else image
    )
    gray = cv2.cvtColor(small, cv2.COLOR_RGB2GRAY)

    report = QualityReport(
        ok=True,
        width=width,
        height=height,
        sharpness=sharpness(gray),
        brightness=float(gray.mean()),
        clipped_fraction=float(((gray <= 5) | (gray >= 250)).mean()),
    )

    if min(width, height) < limits.min_side_px:
        report.problems.append(
            f"The photo is too small ({width}×{height}). Please use a photo at least "
            f"{limits.min_side_px} pixels on each side."
        )
    if max(width, height) > limits.max_side_px:
        report.problems.append("The photo is too large. Please use a normal phone photo.")
    if report.sharpness < limits.min_sharpness:
        report.problems.append(
            "The photo looks blurry. Hold the phone steady, tap the wound to focus and try again."
        )
    if report.brightness < limits.min_brightness:
        report.problems.append("The photo is too dark. Please take it in good light.")
    elif report.brightness > limits.max_brightness:
        report.problems.append(
            "The photo is too bright or washed out. Avoid direct sunlight and flash glare."
        )
    if report.clipped_fraction > limits.max_clipped_fraction:
        report.problems.append(
            "Large parts of the photo are completely black or white. "
            "Please retake it with even light."
        )

    report.ok = not report.problems
    return report
