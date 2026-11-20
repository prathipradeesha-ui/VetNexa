from pathlib import Path

import pytest
import torch

from vetnexa_ai.config import CLASSES, IMAGE_SIZE
from vetnexa_ai.dataset import class_weights, group_of, scan_dataset, split_dataset
from vetnexa_ai.preprocessing import eval_transform, train_transform
from vetnexa_ai.synthetic import generate


@pytest.fixture(scope="module")
def dataset_dir(tmp_path_factory) -> Path:
    root = tmp_path_factory.mktemp("synthetic")
    generate(root, per_class=28)
    return root


def test_groups_photos_of_the_same_wound():
    assert group_of(Path("data/laceration/case014__2.jpg")) == "laceration/case014"
    assert group_of(Path("data/laceration/single.jpg")) == "laceration/single"


def test_skips_exact_duplicate_files(dataset_dir, tmp_path):
    root = tmp_path / "dup"
    for name in CLASSES:
        (root / name).mkdir(parents=True)
        source = next((dataset_dir / name).glob("*.jpg"))
        (root / name / "a.jpg").write_bytes(source.read_bytes())
        (root / name / "b.jpg").write_bytes(source.read_bytes())  # same content
    assert len(scan_dataset(root)) == len(CLASSES)


def test_reports_missing_class_folders(tmp_path):
    with pytest.raises(FileNotFoundError, match="Missing class folders"):
        scan_dataset(tmp_path)


def test_split_keeps_each_wound_in_one_part_and_every_class_in_every_part(dataset_dir):
    split = split_dataset(scan_dataset(dataset_dir))
    parts = {name: {s.group for s in getattr(split, name)} for name in ("train", "val", "test")}

    assert not parts["train"] & parts["val"]
    assert not parts["train"] & parts["test"]
    assert not parts["val"] & parts["test"]
    for name in ("train", "val", "test"):
        assert {s.label for s in getattr(split, name)} == set(range(len(CLASSES)))
    total = len(split.train) + len(split.val) + len(split.test)
    assert 0.6 < len(split.train) / total < 0.8


def test_class_weights_favour_rare_classes(dataset_dir):
    samples = scan_dataset(dataset_dir)
    rare = [s for s in samples if s.label != 0] + [s for s in samples if s.label == 0][:4]
    weights = class_weights(rare, len(CLASSES))
    assert weights[0] > weights[1]


def test_transforms_produce_normalised_model_input(dataset_dir):
    from vetnexa_ai.dataset import read_rgb

    image = read_rgb(str(next((dataset_dir / "abrasion").glob("*.jpg"))))
    for transform in (eval_transform, train_transform):
        tensor = transform(image)
        assert tensor.shape == (3, IMAGE_SIZE, IMAGE_SIZE)
        assert tensor.dtype == torch.float32
        assert -3 < tensor.mean() < 3
    assert torch.equal(eval_transform(image), eval_transform(image))  # deterministic
