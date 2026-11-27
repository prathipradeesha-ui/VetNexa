"""Builds the training folder for the skin-condition model from the curated photo collections.

    python -m vetnexa_ai.skin_dataset          # writes data/skin-conditions/<class>/

Both the verified and the community collection are used (each photo already checked for
duplicates, clarity and species). Categories with too few photos to learn from are left out,
and closely related categories are combined:

    healthy           healthy_skin
    ringworm          ringworm
    mange             mange_scabies
    fungal_infection  fungal_infection
    dermatitis        dermatitis, allergic_dermatitis, flea_allergy, bacterial_dermatosis, hot_spot

Each photo is copied as <species>-<source file name>, so its origin stays visible, and
SKIN_SOURCES.csv lists where every photo came from. The name has no "__", because the training
split treats the text before "__" as a case id; near-identical photos of one case were already
removed during curation, so each photo is its own group.
"""

from __future__ import annotations

import csv
import shutil
from collections import Counter
from pathlib import Path

from .curation import AI_ROOT, DATASETS, TIERS

SKIN_CLASSES: tuple[str, ...] = ("healthy", "ringworm", "mange", "fungal_infection", "dermatitis")

CATEGORY_TO_CLASS = {
    "healthy_skin": "healthy",
    "ringworm": "ringworm",
    "mange_scabies": "mange",
    "fungal_infection": "fungal_infection",
    "dermatitis": "dermatitis",
    "allergic_dermatitis": "dermatitis",
    "flea_allergy": "dermatitis",
    "bacterial_dermatosis": "dermatitis",
    "hot_spot": "dermatitis",
}

SKIN_CLASS_LABELS = {
    "healthy": "Healthy skin and coat",
    "ringworm": "Ringworm (fungal, contagious)",
    "mange": "Mange or scabies (mites)",
    "fungal_infection": "Other fungal skin infection",
    "dermatitis": "Inflamed or allergic skin (dermatitis, allergy, bacterial, hot spot)",
}

OUT = AI_ROOT / "data" / "skin-conditions"


def build(out: Path = OUT) -> Counter:
    if out.exists():
        shutil.rmtree(out)
    counts: Counter = Counter()
    records = []
    for tier in ("verified", "community"):
        settings = TIERS[tier]
        folder = AI_ROOT / "data" / settings.folder
        manifest = (DATASETS / settings.records if settings.records else DATASETS) / "manifest.csv"
        if not manifest.exists():
            continue
        with manifest.open(encoding="utf-8") as f:
            for row in csv.DictReader(f):
                target_class = CATEGORY_TO_CLASS.get(row["category"])
                source = folder / row["file"]
                if target_class is None or not source.exists():
                    continue
                name = Path(row["file"]).name.replace("__", "-")
                target = out / target_class / f"{row['species']}-{name}"
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(source, target)
                counts[target_class] += 1
                records.append(
                    {
                        "class": target_class,
                        "file": f"{target_class}/{target.name}",
                        "tier": tier,
                        "species": row["species"],
                        "category": row["category"],
                        "source_id": row["source_id"],
                        "licence": row["licence"],
                        "sha256": row["sha256"],
                    }
                )
    with (out / "SKIN_SOURCES.csv").open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(records[0]))
        writer.writeheader()
        writer.writerows(records)
    return counts


if __name__ == "__main__":
    for name, n in sorted(build().items()):
        print(f"{name:18} {n}")
