"""Rules used to organise the dog and cat image collections (vetnexa_ai.curation)."""

import cv2
import numpy as np

from vetnexa_ai import curation
from vetnexa_ai.curation import LABEL_MAP, TIERS, normalise, unclear_reason


def test_tiers_never_share_sources_or_folders():
    verified, community = TIERS["verified"], TIERS["community"]
    assert verified.provenance.isdisjoint(community.provenance)
    assert verified.folder != community.folder
    assert verified.records != community.records
    assert "verified" in verified.provenance
    assert "uploader-asserted, contradicted" in community.provenance


def test_only_the_community_tier_filters_unclear_photos_and_verified_copies():
    assert TIERS["community"].clarity_check and TIERS["community"].skip_verified_copies
    assert not TIERS["verified"].clarity_check
    assert not TIERS["verified"].skip_verified_copies


def textured(brightness: int, seed: int = 0) -> np.ndarray:
    rng = np.random.default_rng(seed)
    noise = rng.integers(-60, 60, size=(400, 400, 3))
    return np.clip(brightness + noise, 0, 255).astype(np.uint8)


def test_clear_photo_is_kept():
    assert unclear_reason(textured(128)) is None


def test_blurry_photo_is_left_out():
    flat = np.full((400, 400, 3), 128, np.uint8)
    assert unclear_reason(flat).startswith("not clear: blurry")


def test_studio_cut_outs_and_rotated_copies_are_left_out():
    image = textured(128)
    image[:, :260] = 255  # most of the frame is plain white
    assert "plain black or white" in unclear_reason(image)


def test_dark_and_washed_out_photos_are_left_out():
    assert "too dark" in unclear_reason(textured(15))
    assert "washed out" in unclear_reason(textured(240))


def test_every_source_label_maps_to_a_described_category():
    for label, category in LABEL_MAP.items():
        assert label == normalise(label)
        assert category in curation.CATEGORY_DESCRIPTIONS


def test_new_cat_and_injury_labels():
    assert LABEL_MAP[normalise("Eosinophilic Plague")] == "eosinophilic_plaque"
    assert LABEL_MAP[normalise("Miliary Dermatitis")] == "miliary_dermatitis"
    assert LABEL_MAP["mites"] == "mange_scabies"
    assert LABEL_MAP["injury"] == "wound_injury"


def test_other_animals_are_never_kept():
    for label in curation.OTHER_ANIMAL_LABELS:
        assert label not in LABEL_MAP


def test_textbook_figures_are_recognised_by_the_isbn_in_the_name():
    assert curation.ISBN.search("B9781416056638000070_f007-043-9781416056638.jpg")
    assert not curation.ISBN.search("IMG_20240311_101500.jpg")


def test_community_tier_keeps_one_photo_per_case():
    assert TIERS["community"].same_case_similarity == 0.70
    assert TIERS["verified"].same_case_similarity is None


def test_artificial_speckle_noise_is_recognised():
    photo = textured(128)
    smooth = cv2.GaussianBlur(photo, (9, 9), 0)
    assert not curation.has_speckle_noise(smooth)
    speckled = smooth.copy()
    rng = np.random.default_rng(1)
    ys, xs = rng.integers(0, 400, 2000), rng.integers(0, 400, 2000)
    speckled[ys, xs] = rng.choice([0, 255], size=(2000, 1))
    assert curation.has_speckle_noise(speckled)
