import cv2
import numpy as np
import pytest

from vetnexa_ai.synthetic import draw


@pytest.fixture
def rng():
    return np.random.default_rng(1)


@pytest.fixture
def good_image(rng):
    """A sharp, well-exposed 320×320 RGB image."""
    return draw("laceration", rng)


def encode(image: np.ndarray, ext: str = ".jpg") -> bytes:
    ok, buffer = cv2.imencode(ext, cv2.cvtColor(image, cv2.COLOR_RGB2BGR))
    assert ok
    return buffer.tobytes()
