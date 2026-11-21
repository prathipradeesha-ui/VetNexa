"""Numbered contact sheets for checking every image of a collection by eye.

    python -m vetnexa_ai.review_sheets --tier community

Writes data/<collection>/_check/sheet_001.jpg … with a number on every tile, and index.csv that
maps each number to the original file. Decisions (another animal, stock-photo watermark, a
cropped copy) are then recorded in datasets/species_review.csv, which curation.py reads, so a
rebuild leaves those images out and the reason is kept in excluded.csv.
"""

from __future__ import annotations

import argparse
import csv
from pathlib import Path

import cv2
import numpy as np

from .curation import AI_ROOT, DATASETS, TIERS

COLUMNS = 8
ROWS = 6
TILE = 180


def tile_for(path: Path, number: int) -> np.ndarray:
    image = cv2.imread(str(path))
    tile = (
        cv2.resize(image, (TILE, TILE), interpolation=cv2.INTER_AREA)
        if image is not None
        else np.zeros((TILE, TILE, 3), np.uint8)
    )
    cv2.rectangle(tile, (0, 0), (58, 24), (0, 0, 0), -1)
    cv2.putText(tile, str(number), (3, 18), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 2)
    return tile


def make_sheets(tier: str) -> int:
    settings = TIERS[tier]
    out = AI_ROOT / "data" / settings.folder
    records = DATASETS / settings.records if settings.records else DATASETS
    with (records / "manifest.csv").open(encoding="utf-8") as f:
        rows = sorted(csv.DictReader(f), key=lambda r: (r["source_id"], r["file"]))
    folder = out / "_check"
    folder.mkdir(parents=True, exist_ok=True)
    for old in folder.glob("sheet_*.jpg"):
        old.unlink()
    per_sheet = COLUMNS * ROWS
    with (folder / "index.csv").open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["number", "sheet", "original_path", "file", "source_id", "category"])
        for start in range(0, len(rows), per_sheet):
            sheet_no = start // per_sheet + 1
            tiles = []
            for number, row in enumerate(rows[start : start + per_sheet], start + 1):
                tiles.append(tile_for(out / row["file"], number))
                writer.writerow(
                    [
                        number,
                        sheet_no,
                        row["original_path"],
                        row["file"],
                        row["source_id"],
                        row["category"],
                    ]
                )
            while len(tiles) % COLUMNS:
                tiles.append(np.full((TILE, TILE, 3), 255, np.uint8))
            grid = np.vstack(
                [np.hstack(tiles[i : i + COLUMNS]) for i in range(0, len(tiles), COLUMNS)]
            )
            sheet_path = folder / f"sheet_{sheet_no:03d}.jpg"
            cv2.imwrite(str(sheet_path), grid, [cv2.IMWRITE_JPEG_QUALITY, 85])
    return len(rows)


def main() -> None:
    parser = argparse.ArgumentParser(description="Numbered contact sheets for a visual check.")
    parser.add_argument("--tier", choices=sorted(TIERS), default="community")
    count = make_sheets(parser.parse_args().tier)
    print(f"{count} images on {-(-count // (COLUMNS * ROWS))} sheets")


if __name__ == "__main__":
    main()
