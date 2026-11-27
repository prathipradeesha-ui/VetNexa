"""Builds the organised dog and cat image collection from downloaded open datasets.

    python -m vetnexa_ai.curation                    # verified tier (default)
    python -m vetnexa_ai.curation --tier community   # community tier, kept separately

Reads every source under data/raw/<source-id>/ (see datasets/sources.json), and writes:

    data/dogs-cats/<category>/<species>/<source-id>__<original name>.<ext>   ← the images
    data/dogs-cats/_previews/<category>__<species>.jpg                        ← contact sheets
    datasets/manifest.csv     one row per kept image: where it came from, licence, fingerprint
    datasets/excluded.csv     every image left out, and why
    datasets/summary.json     counts per category, species and source

Rules applied (the same as in datasets/sources.json):
  * dogs and cats only;
  * real photographs only – augmented copies (flipped, rotated, re-coloured versions of the
    same photo that some datasets add) and duplicates shared between datasets are removed;
  * only sources whose licence allows reuse with attribution.
Original files are copied byte for byte, never re-encoded, so they stay identical to the source.

Two tiers are built separately and never mixed (see TIERS): "verified" (data published by the
people who took it) and "community" (open-licence uploads to Kaggle and Roboflow whose
photographers cannot be confirmed). The community tier is written to data/dogs-cats-community/
with its own records in datasets/community/.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import shutil
from collections import Counter, defaultdict
from collections.abc import Iterator
from dataclasses import dataclass, field
from pathlib import Path

import cv2
import numpy as np

from .config import QUALITY
from .quality import check_quality

AI_ROOT = Path(__file__).resolve().parent.parent
RAW = AI_ROOT / "data" / "raw"
OUT = AI_ROOT / "data" / "dogs-cats"
DATASETS = AI_ROOT / "datasets"
IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}

# ─────────────────────────────── Common categories ───────────────────────────────

#: Every source uses its own label names. They are mapped onto these shared categories.
CATEGORY_DESCRIPTIONS = {
    "healthy_skin": "Healthy skin and coat, no visible lesion",
    "bacterial_dermatosis": "Bacterial skin infection (pyoderma)",
    "fungal_infection": "Fungal skin infection other than ringworm",
    "ringworm": "Dermatophytosis: circular, scaly, hairless patches",
    "allergic_dermatitis": "Hypersensitivity / allergic dermatitis (atopy, food or contact)",
    "flea_allergy": "Flea allergy dermatitis",
    "dermatitis": "Dermatitis not further specified by the source",
    "mange_scabies": "Mite infestations: sarcoptic mange, scabies, demodicosis",
    "hot_spot": "Acute moist dermatitis (hot spot)",
    "alopecia": "Hair loss (alopecia) as labelled by the source",
    "eosinophilic_plaque": "Feline eosinophilic plaque (eosinophilic granuloma complex)",
    "miliary_dermatitis": "Feline miliary dermatitis: many small crusted bumps",
    "dandruff_scaling": "Dandruff or scaling of the skin",
    "wound_injury": "Visible wound or injury",
    "uninjured": "Whole animal with no visible injury",
}

LABEL_MAP: dict[str, str] = {
    # healthy
    "healthy": "healthy_skin",
    "health": "healthy_skin",
    "fine": "healthy_skin",
    "normal": "healthy_skin",
    # infections
    "bacterial_dermatosis": "bacterial_dermatosis",
    "bacterial dermatosis": "bacterial_dermatosis",
    "bacterial-dermatosis": "bacterial_dermatosis",
    "fungal_infections": "fungal_infection",
    "fungal infection": "fungal_infection",
    "fungal-infection": "fungal_infection",
    "fungal_infection": "fungal_infection",
    "jamuran": "fungal_infection",  # Indonesian for fungal infection
    "ringworm": "ringworm",
    # allergy and dermatitis
    "hypersensitivity_allergic_dermatosis": "allergic_dermatitis",
    "hypersensitivity-allergic-dermatosis": "allergic_dermatitis",
    "hypersensitivity dermatitis": "allergic_dermatitis",
    "hypersensitivity_dermatitis": "allergic_dermatitis",
    "hypersensitivity": "allergic_dermatitis",
    "flea_allergy": "flea_allergy",
    "flea allergy": "flea_allergy",
    "dermatitis": "dermatitis",
    # parasites
    "mange": "mange_scabies",
    "scabies": "mange_scabies",
    "scabbies": "mange_scabies",
    "demodicosis": "mange_scabies",
    "mites": "mange_scabies",
    "hotspot": "hot_spot",
    "hot spot": "hot_spot",
    # feline skin conditions
    "alopecia": "alopecia",
    "eosinophilic plague": "eosinophilic_plaque",  # spelling used by the source
    "eosinophilic plaque": "eosinophilic_plaque",
    "miliary dermatitis": "miliary_dermatitis",
    "dandruff": "dandruff_scaling",
    "hot_spot": "hot_spot",
    # Wikimedia Commons labels (from each file's description)
    "dog bite wound (stapled)": "wound_injury",
    "surgical wound after amputation": "wound_injury",
    "injured dog": "wound_injury",
    "anal gland abscess": "wound_injury",
    "cat fight wound": "wound_injury",
    "shoulder injury": "wound_injury",
    "wound": "wound_injury",
    "wound with myiasis": "wound_injury",
    "demodectic mange": "mange_scabies",
    "notoedres mange": "mange_scabies",
    "lick granuloma": "dermatitis",
    "ringworm (pseudomycetoma)": "ringworm",
    # injuries
    "injured": "wound_injury",
    "injury": "wound_injury",
    "injured-dogs": "wound_injury",
    "injured cat": "wound_injury",
    "open wound": "wound_injury",
    "uninjured dogs": "uninjured",
    "uninjured cat": "uninjured",
}

#: Where a source uses a shared label with a different meaning. In the injury datasets,
#: "healthy" is a whole animal without injuries, not a close-up of healthy skin.
#: Boxes that mean another kind of animal is in the photo; such photos are left out so the
#: collection shows dogs and cats only. (People may appear, e.g. a vet holding a dog.)
OTHER_ANIMAL_LABELS = {
    "cow",
    "buffalo",
    "buffao",
    "injured cow",
    "injured buffalo",
    "uninjured cow",
}

#: Detection sets that box the animal ("dog", "cat") and, separately, any injury: an animal
#: without an injury box is an uninjured animal.
UNINJURED_WITHOUT_INJURY_BOX = {
    "roboflow-sunny-injured-animal-detector",
    "roboflow-school-injured-animal-detector2",
    "roboflow-imtired-injured-animal-detector-new",
}

SOURCE_LABEL_OVERRIDES: dict[str, dict[str, str]] = {
    "roboflow-resqpetai-injury-classifier": {"healthy": "uninjured"},
}

#: Labels in mixed-animal datasets that tell us the species.
SPECIES_LABELS = {
    "dog": "dog",
    "dogs": "dog",
    "injured-dogs": "dog",
    "uninjured dogs": "dog",
    "cat": "cat",
    "injured cat": "cat",
    "uninjured cat": "cat",
}
NON_TARGET_LABELS = {
    "human",
    "person",
    "cow",
    "buffalo",
    "buffao",
    "injured cow",
    "injured buffalo",
    "uninjured cow",
    "uninjured",  # plain "uninjured" in those sets is not species-specific
}


def normalise(label: str) -> str:
    return re.sub(r"\s+", " ", label.strip().lower())


# ─────────────────────────────── Reading sources ───────────────────────────────


@dataclass
class Item:
    source_id: str
    path: Path
    original_label: str
    species: str | None  #: "dog", "cat" or None when it cannot be determined
    group: str  #: same original photo (Roboflow augmentations share it)
    labels_seen: list[str] = field(default_factory=list)


def roboflow_original_stem(name: str) -> str:
    """Roboflow names exports 'photo123_jpg.rf.<hash>.jpg'; augmented copies of the same photo
    share 'photo123'. Returns that original stem."""
    return re.split(r"_(?:jpg|jpeg|png|webp)\.rf\.", Path(name).stem, maxsplit=1)[0]


def read_mendeley(source_dir: Path, source_id: str) -> Iterator[Item]:
    """95 dogs, one folder each. pic0 is the white-light photo; pic1-9 are narrow-band
    multispectral frames that do not look like phone photos and are not used."""
    labels_file = next(source_dir.rglob("image_label.txt"))
    labels = dict(line.split() for line in labels_file.read_text().splitlines() if line.strip())
    # The label file covers 62 of the 95 folders; the other 33 have no label in the source.
    for photo in sorted(source_dir.rglob("pic0.jpg")):
        folder = photo.parent.name
        yield Item(
            source_id,
            photo,
            labels.get(folder, "(no label in source)"),
            "dog",
            f"{source_id}/{folder}",
        )


def read_listed_files(source_dir: Path, source_id: str) -> Iterator[Item]:
    """Photos chosen one by one (e.g. from Wikimedia Commons), listed in files.csv with their
    species, label, licence and author. Each label comes from the file's own description."""
    with (source_dir / "files.csv").open(encoding="utf-8") as f:
        for row in csv.DictReader(f):
            path = source_dir / row["file"]
            if path.exists():
                group = f"{source_id}/{path.stem}"
                yield Item(source_id, path, row["label"], row["species"], group)


def read_class_folders(source_dir: Path, source_id: str, species: str) -> Iterator[Item]:
    """Datasets organised as <class>/<image> (Kaggle, Roboflow 'folder' exports)."""
    for path in sorted(source_dir.rglob("*")):
        if path.suffix.lower() not in IMAGE_EXT:
            continue
        label = path.parent.name
        if normalise(label) in {"train", "valid", "val", "test"}:
            continue  # image directly inside a split folder: no class
        stem = roboflow_original_stem(path.name)
        yield Item(source_id, path, label, species, f"{source_id}/{stem}")


def read_coco(source_dir: Path, source_id: str, species: str | None) -> Iterator[Item]:
    """Roboflow COCO exports: labels come from the bounding boxes in _annotations.coco.json.
    The image label is the most frequent box label; mixed-animal sets also give the species."""
    for coco_file in sorted(source_dir.rglob("_annotations.coco.json")):
        data = json.loads(coco_file.read_text(encoding="utf-8"))
        categories = {c["id"]: c["name"] for c in data["categories"]}
        boxes: dict[int, list[str]] = defaultdict(list)
        for a in data["annotations"]:
            boxes[a["image_id"]].append(categories[a["category_id"]])
        for image in data["images"]:
            names = boxes.get(image["id"], [])
            path = coco_file.parent / image["file_name"]
            if not path.exists():
                continue
            normalised = [normalise(n) for n in names]
            found_species = {SPECIES_LABELS[n] for n in normalised if n in SPECIES_LABELS}
            condition = [n for n in normalised if n in LABEL_MAP]
            label = (
                Counter(condition).most_common(1)[0][0]
                if condition
                else (normalised[0] if normalised else "")
            )
            if not condition and found_species and source_id in UNINJURED_WITHOUT_INJURY_BOX:
                label = "uninjured dogs" if found_species == {"dog"} else "uninjured cat"
            if any(n in OTHER_ANIMAL_LABELS for n in normalised):
                label = "(another kind of animal in the photo)"
            item_species = species
            if species is None:
                item_species = found_species.pop() if len(found_species) == 1 else None
            yield Item(
                source_id,
                path,
                label,
                item_species,
                f"{source_id}/{roboflow_original_stem(image['file_name'])}",
                normalised,
            )


@dataclass(frozen=True)
class Tier:
    """Which sources a collection accepts and where it is written."""

    provenance: frozenset[str]
    folder: str  #: under data/
    records: str  #: under datasets/ ("" for the top level)
    #: Leave out blurry, too dark or washed-out photos (the same limits as the wound check).
    clarity_check: bool = False
    #: Leave out photos that are already in the verified collection.
    skip_verified_copies: bool = False
    #: Keep one photo per case: a photo whose image features are at least this similar to an
    #: already kept photo (cosine similarity of EfficientNet-B0 features) is left out. None
    #: switches the check off.
    same_case_similarity: float | None = None


#: Decision of 2026-11-21: the main collection holds verified original data only, because
#: inspection showed that community "open" pet datasets re-publish stock and website photos
#: their uploaders do not own. Later the same day the project owner asked for the real
#: community photos as well, so they form a second tier that is built and recorded separately,
#: with stock-watermarked images removed after a visual check of every image.
TIERS = {
    "verified": Tier(frozenset({"verified"}), "dogs-cats", ""),
    "community": Tier(
        frozenset(
            {
                "uploader-asserted",
                "uploader-asserted, not yet inspected",
                "uploader-asserted, contradicted",
            }
        ),
        "dogs-cats-community",
        "community",
        clarity_check=True,
        skip_verified_copies=True,
        # Checked on contact sheets (2026-11-21): known rotated and cropped copies scored
        # 0.85-0.88, and nearly all pairs from 0.70 upwards were the same animal and lesion in
        # another crop or another frame of the same video. Ordinary different photos scored less.
        same_case_similarity=0.70,
    ),
}

#: The provenance levels of the default (verified) tier.
ACCEPTED_PROVENANCE = set(TIERS["verified"].provenance)

#: Mixed-animal sources whose images get the automatic dog/cat check.
SPECIES_CHECKED_SOURCES = {
    "roboflow-resqpetai-injury-classifier",
    "roboflow-school-injured-dog-detector",
    "roboflow-school-injured-animal-detector2",
    "roboflow-imtired-injured-animal-detector-new",
    "roboflow-animalwounded-injured-dog-detector",
    "roboflow-sunny-injured-animal-detector",
}

#: How to read each source, in priority order: when the same photo appears in several
#: datasets, the copy from the earliest source here is kept.
READERS = [
    ("mendeley-5dbht54kw7", lambda d, s: read_mendeley(d, s)),
    ("kaggle-yashmotiani-dogs-skin-disease", lambda d, s: read_class_folders(d, s, "dog")),
    ("kaggle-youssefmohmmed-dogs-skin-diseases", lambda d, s: read_class_folders(d, s, "dog")),
    ("roboflow-dog-skin-disease-dermatosis", lambda d, s: read_class_folders(d, s, "dog")),
    (
        "roboflow-majorproject-dog-skin-disease-prediction",
        lambda d, s: read_class_folders(d, s, "dog"),
    ),
    ("roboflow-litespy-dog-skin-diseases", lambda d, s: read_coco(d, s, "dog")),
    ("roboflow-kat-cat-skin-disease", lambda d, s: read_class_folders(d, s, "cat")),
    ("roboflow-bios-cat-skin-disease", lambda d, s: read_class_folders(d, s, "cat")),
    ("roboflow-humaira-feline-health-conditions", lambda d, s: read_coco(d, s, "cat")),
    ("roboflow-resqpetai-injury-classifier", lambda d, s: read_class_folders(d, s, None)),
    ("roboflow-animalwounded-injured-dog-detector", lambda d, s: read_coco(d, s, None)),
    ("roboflow-sunny-injured-animal-detector", lambda d, s: read_coco(d, s, None)),
    ("roboflow-school-injured-dog-detector", lambda d, s: read_coco(d, s, None)),
    ("roboflow-school-injured-animal-detector2", lambda d, s: read_coco(d, s, None)),
    ("roboflow-imtired-injured-animal-detector-new", lambda d, s: read_coco(d, s, None)),
    ("roboflow-fyp-cat-skin-disease", lambda d, s: read_coco(d, s, "cat")),
    ("wikimedia-commons", lambda d, s: read_listed_files(d, s)),
    ("roboflow-commission-cat-infections", lambda d, s: read_coco(d, s, "cat")),
]

# ─────────────────────────────── Fingerprints ───────────────────────────────


def dhash_variants(image: np.ndarray) -> list[int]:
    """256-bit difference hashes of the image and its flips / 90° rotations, so a mirrored or
    rotated augmented copy is recognised as the same photo.

    256 bits rather than the usual 64: on close-up skin photos taken with the same device, 64-bit
    hashes of different dogs were sometimes identical. With 256 bits, different dogs in the
    Mendeley set were at least 23 bits apart, while re-encoded or brightened copies were 0."""
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    variants = [
        gray,
        cv2.flip(gray, 1),
        cv2.flip(gray, 0),
        cv2.rotate(gray, cv2.ROTATE_90_CLOCKWISE),
        cv2.rotate(gray, cv2.ROTATE_180),
        cv2.rotate(gray, cv2.ROTATE_90_COUNTERCLOCKWISE),
    ]
    hashes = []
    for v in variants:
        small = cv2.resize(v, (17, 16), interpolation=cv2.INTER_AREA)
        bits = (small[:, 1:] > small[:, :-1]).flatten()
        hashes.append(int("".join("1" if b else "0" for b in bits), 2))
    return hashes


# ─────────────────────────────── Species check ───────────────────────────────


class SpeciesChecker:
    """Decides whether a whole-animal photo shows a dog or a cat, for datasets that mix species.

    Uses a ResNet-50 trained on ImageNet, whose 1,000 classes include 118 dog breeds
    (indices 151-268), 5 domestic cat classes (281-285) and many other animals (0-397). The
    probabilities in each group are added up. A species is accepted automatically only when its
    group has at least 25% and at least twice as much as each other group. Injured animals,
    close-ups and odd angles often fail this test; those images go to a manual review queue
    rather than being guessed.
    """

    DOG = list(range(151, 269))
    CAT = list(range(281, 286))
    OTHER_ANIMALS = [i for i in range(0, 398) if not (151 <= i <= 268 or 281 <= i <= 285)]

    def __init__(self) -> None:
        import torch
        from torchvision.models import ResNet50_Weights, resnet50

        self.torch = torch
        weights = ResNet50_Weights.IMAGENET1K_V2
        self.model = resnet50(weights=weights).eval()
        self.preprocess = weights.transforms()

    def __call__(self, image_bgr: np.ndarray) -> tuple[str | None, float, float, float]:
        from PIL import Image

        rgb = Image.fromarray(cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB))
        with self.torch.no_grad():
            probs = self.model(self.preprocess(rgb).unsqueeze(0)).softmax(1)[0]
        dog, cat = float(probs[self.DOG].sum()), float(probs[self.CAT].sum())
        other = float(probs[self.OTHER_ANIMALS].sum())
        if dog >= 0.25 and dog >= 2 * cat and dog >= 2 * other:
            return "dog", dog, cat, other
        if cat >= 0.25 and cat >= 2 * dog and cat >= 2 * other:
            return "cat", dog, cat, other
        return None, dog, cat, other


# ─────────────────────────────── Not-a-real-photo checks ───────────────────────────────


def is_narrow_band_frame(image: np.ndarray) -> bool:
    """Multispectral frames lit by a single colour (blue, green, red...) rather than white
    light. One colour channel dominates the others by more than 2x; ordinary photos do not."""
    means = [max(1.0, c) for c in cv2.mean(cv2.resize(image, (160, 90)))[:3]]
    return max(means) / min(means) > 2.0


def has_rotation_fill(image: np.ndarray) -> bool:
    """Augmented copies rotated by an odd angle have triangles of one flat fill colour in the
    corners, while the rotated photo still touches the frame near the middle of each edge.

    True when at least two corner patches are perfectly flat AND at least three edge-midpoint
    patches contain real texture. The second condition separates rotated copies from genuine
    studio photos on a plain white or black backdrop, whose edges are flat as well."""
    small = cv2.resize(image, (200, 200), interpolation=cv2.INTER_AREA)
    gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
    k = 14
    mid = (200 - k) // 2
    corners = [gray[:k, :k], gray[:k, -k:], gray[-k:, :k], gray[-k:, -k:]]
    edge_middles = [
        gray[:k, mid : mid + k],
        gray[-k:, mid : mid + k],
        gray[mid : mid + k, :k],
        gray[mid : mid + k, -k:],
    ]
    flat_corners = sum(float(c.std()) < 1.5 for c in corners)
    textured_edges = sum(float(e.std()) >= 4.0 for e in edge_middles)
    return flat_corners >= 2 and textured_edges >= 3


def hamming(a: int, b: int) -> int:
    return (a ^ b).bit_count()


# ─────────────────────────────── Build ───────────────────────────────


def rejection_reason(review: dict) -> str | None:
    """Why the visual check rejected a photo, or None if it was not rejected."""
    if review.get("watermark"):
        return f"watermark ({review['watermark']})"
    if review.get("exclude"):
        return review["exclude"]
    if review.get("species") in ("other", "unclear"):
        return "not a dog or cat"
    return None


def load_species_reviews() -> dict[str, dict]:
    """Manual review decisions from datasets/species_review.csv, keyed by original path.

    Columns: original_path, species ("dog", "cat", "other", "unclear" or empty to keep the
    source's species), watermark (stock-photo agency seen on the image), duplicate_of
    (path of the same photo when a cropped copy was spotted), reviewed_on, review_number, note.
    """
    path = DATASETS / "species_review.csv"
    if not path.exists():
        return {}
    with path.open(encoding="utf-8") as f:
        return {r["original_path"].replace("\\", "/"): r for r in csv.DictReader(f)}


def load_sources() -> dict[str, dict]:
    data = json.loads((DATASETS / "sources.json").read_text(encoding="utf-8"))
    return {s["id"]: s for s in data["sources"]}


#: Sharpness limit for collected photos. Many community photos are small web images, and close-ups
#: scoring 45-60 were still clearly usable, while those under about 30 were visibly blurred
#: (checked on contact sheets, 2026-11-21). The wound check keeps its stricter limit of 60 for
#: photos owners upload, because it judges a single photo, not a training set.
CURATION_MIN_SHARPNESS = 35.0


#: Single photos chosen and checked one by one from their original pages. They are originals,
#: never augmented copies, so the speckle-noise rule (aimed at augmented datasets) is not used.
HAND_PICKED_SOURCES = {"wikimedia-commons"}

#: Share of pixels that differ sharply from their 3x3 median. Augmented copies with added
#: "salt and pepper" speckles score 0.24 % or more; real photos checked on contact sheets scored
#: at most 0.16 % (2026-11-21).
SPECKLE_LIMIT = 0.0018


def has_speckle_noise(image: np.ndarray) -> bool:
    """True for copies with artificial salt-and-pepper noise added by data augmentation."""
    # Measured at 640 px (the size it was calibrated on): at full camera resolution, fine fur
    # and skin texture of genuine photos would look like speckles.
    scale = 640 / max(image.shape[:2])
    if scale < 1:
        image = cv2.resize(image, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    difference = np.abs(gray.astype(np.int16) - cv2.medianBlur(gray, 3).astype(np.int16))
    return float((difference > 70).mean()) > SPECKLE_LIMIT


def unclear_reason(image: np.ndarray) -> str | None:
    """Why a photo should be left out of a collection as unclear, or None."""
    report = check_quality(cv2.cvtColor(image, cv2.COLOR_BGR2RGB))
    if report.sharpness < CURATION_MIN_SHARPNESS:
        return f"not clear: blurry (sharpness {report.sharpness:.0f})"
    if report.brightness < QUALITY.min_brightness:
        return f"not clear: too dark (brightness {report.brightness:.0f})"
    if report.brightness > QUALITY.max_brightness:
        return f"not clear: washed out (brightness {report.brightness:.0f})"
    if report.clipped_fraction > QUALITY.max_clipped_fraction:
        # Seen on contact sheets: rotated augmented copies with black corners, and studio
        # cut-outs of whole dogs on a white background (stock-style, not skin photos).
        return "large plain black or white areas (rotated copy or studio cut-out)"
    if min(report.width, report.height) < QUALITY.min_side_px:
        return f"too small ({report.width}x{report.height})"
    return None


#: Book ISBNs in file names show the photo was scanned from a published book, whose
#: illustrations are the publisher's copyright (found in two Kaggle sets, 2026-11-21).
ISBN = re.compile(r"97[89]\d{10}")


class FeatureEmbedder:
    """Unit-length EfficientNet-B0 image features (ImageNet weights) for spotting the same case
    photographed again, cropped, rotated or taken from another video frame."""

    def __init__(self) -> None:
        import torch
        from torchvision.models import EfficientNet_B0_Weights, efficientnet_b0

        weights = EfficientNet_B0_Weights.DEFAULT
        self.torch = torch
        self.model = efficientnet_b0(weights=weights)
        self.model.classifier = torch.nn.Identity()
        self.model.eval()
        self.transform = weights.transforms()

    def __call__(self, image: np.ndarray) -> np.ndarray:
        from PIL import Image

        rgb = Image.fromarray(cv2.cvtColor(image, cv2.COLOR_BGR2RGB))
        with self.torch.no_grad():
            features = self.model(self.transform(rgb).unsqueeze(0))[0].numpy()
        return features / max(float(np.linalg.norm(features)), 1e-9)


def verified_fingerprints() -> tuple[dict[str, str], list[tuple[int, str]]]:
    """SHA-256 and difference hashes of every photo in the verified collection."""
    folder = AI_ROOT / "data" / TIERS["verified"].folder
    shas: dict[str, str] = {}
    hashes: list[tuple[int, str]] = []
    for path in sorted(folder.rglob("*")):
        if path.suffix.lower() not in IMAGE_EXT or path.parent.name.startswith("_"):
            continue
        data = path.read_bytes()
        name = "verified/" + str(path.relative_to(folder)).replace("\\", "/")
        shas[hashlib.sha256(data).hexdigest()] = name
        image = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
        if image is not None:
            hashes.append((dhash_variants(image)[0], name))
    return shas, hashes


def build(tier: str = "verified", near_duplicate_bits: int = 12, min_side: int = 128) -> dict:
    settings = TIERS[tier]
    out = AI_ROOT / "data" / settings.folder
    records = DATASETS / settings.records if settings.records else DATASETS
    sources = load_sources()
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)

    kept: list[dict] = []
    excluded: list[dict] = []
    seen_sha: dict[str, str] = {}
    seen_groups: dict[str, str] = {}
    hash_index: list[tuple[int, str]] = []  # (dhash of kept image, kept file)
    verified_shas: dict[str, str] = {}
    if settings.skip_verified_copies:
        verified_shas, verified_hashes = verified_fingerprints()
        hash_index.extend(verified_hashes)
    embedder = FeatureEmbedder() if settings.same_case_similarity is not None else None
    case_features: list[np.ndarray] = []
    case_files: list[str] = []
    # Photos rejected in the visual check (watermark, caption, other animal, not real...). Their
    # near-copies from any source are rejected too, so a copy cannot take the rejected photo's
    # place in a later build.
    rejected_features: list[np.ndarray] = []
    rejected_reasons: list[tuple[str, str]] = []
    if embedder is not None:
        for original, review in load_species_reviews().items():
            reason = rejection_reason(review)
            path = RAW / original
            if reason and path.exists():
                image = cv2.imread(str(path))
                if image is not None:
                    rejected_features.append(embedder(image))
                    rejected_reasons.append((reason, original))
    if embedder is not None and settings.skip_verified_copies:
        verified_folder = AI_ROOT / "data" / TIERS["verified"].folder
        for path in sorted(verified_folder.rglob("*")):
            if path.suffix.lower() in IMAGE_EXT and not path.parent.name.startswith("_"):
                image = cv2.imread(str(path))
                if image is not None:
                    case_features.append(embedder(image))
                    name = str(path.relative_to(verified_folder)).replace("\\", "/")
                    case_files.append("verified/" + name)
    species_checker: SpeciesChecker | None = None
    reviews = load_species_reviews()
    review_queue: list[dict] = []
    skipped_sources: list[str] = []

    def exclude(item: Item, reason: str, duplicate_of: str = "") -> None:
        excluded.append(
            {
                "source_id": item.source_id,
                "original_path": str(item.path.relative_to(RAW)),
                "original_label": item.original_label,
                "reason": reason,
                "duplicate_of": duplicate_of,
            }
        )

    for source_id, reader in READERS:
        source_dir = RAW / source_id
        if not source_dir.exists():
            continue
        source = sources[source_id]
        if source.get("provenance") not in settings.provenance:
            skipped_sources.append(source_id)
            continue
        for item in reader(source_dir, source_id):
            label = normalise(item.original_label)
            if label in NON_TARGET_LABELS or label not in LABEL_MAP:
                exclude(item, f"label '{item.original_label}' not used")
                continue
            data = item.path.read_bytes()
            sha = hashlib.sha256(data).hexdigest()
            if sha in verified_shas:
                exclude(item, "already in the verified collection", verified_shas[sha])
                continue
            if sha in seen_sha:
                exclude(item, "exact duplicate", seen_sha[sha])
                continue
            if item.group in seen_groups:
                exclude(item, "augmented copy of the same photo", seen_groups[item.group])
                continue
            # Remember the photo as soon as its first copy is considered, even if that copy is
            # later excluded, so its other augmented copies cannot slip through.
            first_seen = str(item.path.relative_to(RAW)).replace("\\", "/")
            seen_sha[sha] = first_seen
            seen_groups[item.group] = first_seen
            image = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
            if image is None:
                exclude(item, "unreadable image")
                continue
            if not source_id.startswith("mendeley") and is_narrow_band_frame(image):
                exclude(item, "multispectral band frame, not a normal photo")
                continue
            # Mendeley's camera frame has naturally flat edges, so it is not checked.
            if not source_id.startswith("mendeley") and has_rotation_fill(image):
                exclude(item, "augmented copy: rotated with filled corners")
                continue
            height, width = image.shape[:2]
            if min(height, width) < min_side:
                exclude(item, f"too small ({width}x{height})")
                continue
            variants = dhash_variants(image)
            match = next(
                (
                    f
                    for h, f in hash_index
                    if min(hamming(h, v) for v in variants) <= near_duplicate_bits
                ),
                None,
            )
            if match and match.startswith("verified/"):
                exclude(item, "already in the verified collection", match)
                continue
            if match:
                exclude(
                    item, "near-duplicate (same photo, possibly flipped/rotated/re-coloured)", match
                )
                continue
            if settings.clarity_check and (reason := unclear_reason(image)):
                exclude(item, reason)
                continue
            if (
                settings.clarity_check
                and source_id not in HAND_PICKED_SOURCES
                and has_speckle_noise(image)
            ):
                exclude(item, "augmented copy: artificial speckle noise (not a real photo)")
                continue
            if settings.clarity_check and (isbn := ISBN.search(item.path.name)):
                exclude(item, f"figure scanned from a published book (ISBN {isbn.group()})")
                continue

            # Species: from the source's labels, a recorded manual review, or the image check.
            species_note = "from source labels"
            original = str(item.path.relative_to(RAW)).replace("\\", "/")
            review = reviews.get(original)
            if review and review.get("duplicate_of"):
                exclude(
                    item, "cropped copy of another photo (manual review)", review["duplicate_of"]
                )
                continue
            if review and review.get("watermark"):
                exclude(item, f"stock-photo watermark: {review['watermark']} (copyright)")
                continue
            if review and review.get("exclude"):
                exclude(item, f"visual check: {review['exclude']}")
                continue
            if item.species is None and review and review.get("species"):
                item.species = review["species"] if review["species"] in ("dog", "cat") else None
                species_note = (
                    f"manual review #{review.get('review_number', '')}: {review['species']}"
                )
                if item.species is None:
                    exclude(item, f"not a dog or cat ({species_note})")
                    continue
            elif item.species is None and source_id in SPECIES_CHECKED_SOURCES:
                species_checker = species_checker or SpeciesChecker()
                item.species, dog, cat, other = species_checker(image)
                species_note = f"image check: dog {dog:.2f}, cat {cat:.2f}, other {other:.2f}"
                if item.species is None:
                    exclude(item, f"species unclear, awaiting manual review ({species_note})")
                    review_queue.append(
                        {
                            "original_path": original,
                            "label": item.original_label,
                            "scores": species_note,
                        }
                    )
                    continue
            if item.species not in ("dog", "cat"):
                exclude(item, "not a dog or cat, or species unclear")
                continue

            if embedder is not None:
                features = embedder(image)
                if rejected_features:
                    similarity = np.stack(rejected_features) @ features
                    best = int(similarity.argmax())
                    if similarity[best] >= settings.same_case_similarity:
                        reason, original = rejected_reasons[best]
                        reason = f"copy of a photo rejected in the visual check: {reason}"
                        exclude(item, reason, original)
                        continue
                if case_features:
                    similarity = np.stack(case_features) @ features
                    best = int(similarity.argmax())
                    if similarity[best] >= settings.same_case_similarity:
                        reason = (
                            "already in the verified collection"
                            if case_files[best].startswith("verified/")
                            else f"same case as a kept photo (similarity {similarity[best]:.2f})"
                        )
                        exclude(item, reason, case_files[best])
                        continue

            category = SOURCE_LABEL_OVERRIDES.get(source_id, {}).get(label, LABEL_MAP[label])
            safe_name = re.sub(r"[^A-Za-z0-9._-]+", "_", item.path.name)
            if source_id.startswith("mendeley"):
                safe_name = f"{item.path.parent.name}_{safe_name}"
            target = out / category / item.species / f"{source_id}__{safe_name}"
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
            relative = str(target.relative_to(out)).replace("\\", "/")
            hash_index.append((variants[0], relative))
            if embedder is not None:
                case_features.append(features)
                case_files.append(relative)
            kept.append(
                {
                    "file": relative,
                    "category": category,
                    "species": item.species,
                    "original_label": item.original_label,
                    "source_id": source_id,
                    "source_name": source.get("name", ""),
                    "source_url": source.get("url", ""),
                    "licence": source.get("licence", ""),
                    "original_path": str(item.path.relative_to(RAW)).replace("\\", "/"),
                    "width": width,
                    "height": height,
                    "sha256": sha,
                    "species_evidence": species_note,
                }
            )

    if skipped_sources:
        print(f"Not in the {tier} tier: {', '.join(skipped_sources)}")
    write_outputs(kept, excluded, records)
    make_previews(kept, out)
    write_review_queue(review_queue, out)
    return summarise(kept, excluded, records, tier)


def write_outputs(kept: list[dict], excluded: list[dict], records: Path = DATASETS) -> None:
    records.mkdir(parents=True, exist_ok=True)
    for name, rows in (("manifest.csv", kept), ("excluded.csv", excluded)):
        with (records / name).open("w", newline="", encoding="utf-8") as f:
            if rows:
                writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
                writer.writeheader()
                writer.writerows(rows)


def make_previews(kept: list[dict], out: Path = OUT, per_sheet: int = 40, tile: int = 160) -> None:
    """One contact sheet per category and species, for quick visual checking and evidence."""
    groups: dict[tuple[str, str], list[str]] = defaultdict(list)
    for row in kept:
        groups[(row["category"], row["species"])].append(row["file"])
    folder = out / "_previews"
    folder.mkdir(exist_ok=True)
    for (category, species), files in groups.items():
        tiles = []
        for relative in files[:per_sheet]:
            image = cv2.imread(str(out / relative))
            if image is not None:
                tiles.append(cv2.resize(image, (tile, tile), interpolation=cv2.INTER_AREA))
        while len(tiles) % 8:
            tiles.append(np.full((tile, tile, 3), 255, np.uint8))
        rows = [np.hstack(tiles[i : i + 8]) for i in range(0, len(tiles), 8)]
        header = np.full((40, rows[0].shape[1], 3), 255, np.uint8)
        cv2.putText(
            header,
            f"{category} / {species} - {len(files)} images "
            f"(first {min(len(files), per_sheet)} shown)",
            (10, 28),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            (60, 40, 10),
            2,
        )
        cv2.imwrite(str(folder / f"{category}__{species}.jpg"), np.vstack([header, *rows]))


def write_review_queue(
    queue: list[dict], out: Path = OUT, per_sheet: int = 30, tile: int = 220
) -> None:
    """Numbered contact sheets of images whose species needs a person to decide."""
    if not queue:
        return
    folder = out / "_review"
    folder.mkdir(exist_ok=True)
    with (folder / "queue.csv").open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["number", "original_path", "label", "scores"])
        writer.writeheader()
        for number, row in enumerate(queue, 1):
            writer.writerow({"number": number, **row})
    for start in range(0, len(queue), per_sheet):
        tiles = []
        for number, row in enumerate(queue[start : start + per_sheet], start + 1):
            image = cv2.imread(str(RAW / row["original_path"]))
            t = (
                cv2.resize(image, (tile, tile))
                if image is not None
                else np.zeros((tile, tile, 3), np.uint8)
            )
            cv2.rectangle(t, (0, 0), (52, 30), (0, 0, 0), -1)
            cv2.putText(t, str(number), (4, 23), cv2.FONT_HERSHEY_SIMPLEX, 0.75, (0, 255, 255), 2)
            tiles.append(t)
        while len(tiles) % 6:
            tiles.append(np.full((tile, tile, 3), 255, np.uint8))
        sheet = np.vstack([np.hstack(tiles[i : i + 6]) for i in range(0, len(tiles), 6)])
        cv2.imwrite(str(folder / f"review_{start // per_sheet + 1:02d}.jpg"), sheet)


def summarise(
    kept: list[dict], excluded: list[dict], records: Path = DATASETS, tier: str = "verified"
) -> dict:
    summary = {
        "tier": tier,
        "kept_images": len(kept),
        "excluded_images": len(excluded),
        "by_category_and_species": {
            f"{c}/{s}": n
            for (c, s), n in sorted(Counter((r["category"], r["species"]) for r in kept).items())
        },
        "by_source": dict(sorted(Counter(r["source_id"] for r in kept).items())),
        "excluded_by_reason": dict(
            Counter(r["reason"].split(" (")[0] for r in excluded).most_common()
        ),
        "categories": CATEGORY_DESCRIPTIONS,
    }
    (records / "summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    return summary


def main() -> None:
    parser = argparse.ArgumentParser(description=(__doc__ or "").split("\n", 1)[0])
    parser.add_argument("--tier", choices=sorted(TIERS), default="verified")
    print(json.dumps(build(parser.parse_args().tier), indent=2))


if __name__ == "__main__":
    main()
