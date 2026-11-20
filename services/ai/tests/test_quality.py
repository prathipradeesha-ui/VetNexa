import cv2
import numpy as np
import pytest

from vetnexa_ai.quality import InvalidImageError, check_quality, decode_image

from .conftest import encode


def test_decodes_jpeg_png_and_webp(good_image):
    for ext in (".jpg", ".png", ".webp"):
        decoded = decode_image(encode(good_image, ext))
        assert decoded.shape == good_image.shape


def test_rejects_bytes_that_are_not_an_image():
    with pytest.raises(InvalidImageError):
        decode_image(b"<script>alert(1)</script>")


def test_accepts_a_sharp_well_lit_photo(good_image):
    report = check_quality(good_image)
    assert report.ok, report.problems


def test_rejects_blurry_photos(good_image):
    blurred = cv2.GaussianBlur(good_image, (31, 31), 12)
    report = check_quality(blurred)
    assert not report.ok
    assert any("blurry" in problem for problem in report.problems)


def test_rejects_dark_and_washed_out_photos(good_image):
    dark = (good_image * 0.12).astype(np.uint8)
    bright = np.clip(good_image.astype(int) + 140, 0, 255).astype(np.uint8)
    assert any("too dark" in p for p in check_quality(dark).problems)
    assert any("too bright" in p for p in check_quality(bright).problems)


def test_rejects_tiny_photos(good_image):
    tiny = cv2.resize(good_image, (120, 120))
    assert any("too small" in p for p in check_quality(tiny).problems)


def test_sharpness_does_not_depend_on_resolution(good_image):
    """Measurements use a downscaled copy, so a 4× larger photo is judged the same way."""
    large = cv2.resize(good_image, None, fx=4, fy=4, interpolation=cv2.INTER_CUBIC)
    assert check_quality(large).ok == check_quality(good_image).ok
