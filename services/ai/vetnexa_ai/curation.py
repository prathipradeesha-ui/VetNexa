"""Builds the organised dog and cat image collection from downloaded open datasets.

    python -m vetnexa_ai.curation

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
"""

from __future__ import annotations

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
    "hotspot": "hot_spot",
    "hot_spot": "hot_spot",
    # injuries
    "injured": "wound_injury",
    "injured-dogs": "wound_injury",
    "injured cat": "wound_injury",
    "open wound": "wound_injury",
    "uninjured dogs": "uninjured",
    "uninjured cat": "uninjured",
}

#: Where a source uses a shared label with a different meaning. In the injury datasets,
#: "healthy" is a whole animal without injuries, not a close-up of healthy skin.
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


#: Only sources with these provenance levels (see sources.json) are used. Decision recorded on
#: 2026-11-21: the collection contains verified original data only, because inspection showed
#: that community "open" pet datasets re-publish stock and website photos their uploaders do
#: not own. Add "uploader-asserted" here to build a second, clearly labelled tier.
ACCEPTED_PROVENANCE = {"verified"}

#: Mixed-animal sources whose images get the automatic dog/cat check.
SPECIES_CHECKED_SOURCES = {
    "roboflow-resqpetai-injury-classifier",
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


def build(near_duplicate_bits: int = 12, min_side: int = 128) -> dict:
    sources = load_sources()
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)

    kept: list[dict] = []
    excluded: list[dict] = []
    seen_sha: dict[str, str] = {}
    seen_groups: dict[str, str] = {}
    hash_index: list[tuple[int, str]] = []  # (dhash of kept image, kept file)
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
        if source.get("provenance") not in ACCEPTED_PROVENANCE:
            skipped_sources.append(source_id)
            continue
        for item in reader(source_dir, source_id):
            label = normalise(item.original_label)
            if label in NON_TARGET_LABELS or label not in LABEL_MAP:
                exclude(item, f"label '{item.original_label}' not used")
                continue
            data = item.path.read_bytes()
            sha = hashlib.sha256(data).hexdigest()
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
            if match:
                exclude(
                    item, "near-duplicate (same photo, possibly flipped/rotated/re-coloured)", match
                )
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

            category = SOURCE_LABEL_OVERRIDES.get(source_id, {}).get(label, LABEL_MAP[label])
            safe_name = re.sub(r"[^A-Za-z0-9._-]+", "_", item.path.name)
            if source_id.startswith("mendeley"):
                safe_name = f"{item.path.parent.name}_{safe_name}"
            target = OUT / category / item.species / f"{source_id}__{safe_name}"
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
            relative = str(target.relative_to(OUT)).replace("\\", "/")
            hash_index.append((variants[0], relative))
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
        print(f"Not used (provenance not verified): {', '.join(skipped_sources)}")
    write_outputs(kept, excluded)
    make_previews(kept)
    write_review_queue(review_queue)
    return summarise(kept, excluded)


def write_outputs(kept: list[dict], excluded: list[dict]) -> None:
    DATASETS.mkdir(exist_ok=True)
    for name, rows in (("manifest.csv", kept), ("excluded.csv", excluded)):
        with (DATASETS / name).open("w", newline="", encoding="utf-8") as f:
            if rows:
                writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
                writer.writeheader()
                writer.writerows(rows)


def make_previews(kept: list[dict], per_sheet: int = 40, tile: int = 160) -> None:
    """One contact sheet per category and species, for quick visual checking and evidence."""
    groups: dict[tuple[str, str], list[str]] = defaultdict(list)
    for row in kept:
        groups[(row["category"], row["species"])].append(row["file"])
    folder = OUT / "_previews"
    folder.mkdir(exist_ok=True)
    for (category, species), files in groups.items():
        tiles = []
        for relative in files[:per_sheet]:
            image = cv2.imread(str(OUT / relative))
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


def write_review_queue(queue: list[dict], per_sheet: int = 30, tile: int = 220) -> None:
    """Numbered contact sheets of images whose species needs a person to decide."""
    if not queue:
        return
    folder = OUT / "_review"
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


def summarise(kept: list[dict], excluded: list[dict]) -> dict:
    summary = {
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
    (DATASETS / "summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    return summary


if __name__ == "__main__":
    print(json.dumps(build(), indent=2))
