"""Turns images into model input tensors, with data augmentation for training.

All images are resized with OpenCV and normalised with the ImageNet statistics that the
pre-trained backbone expects. Training adds random flips, rotations, crops and colour changes
so the model learns the wound, not the lighting, angle or background of particular photos.
"""

from __future__ import annotations

import cv2
import numpy as np
import torch
from torchvision.transforms import v2

from .config import IMAGE_SIZE, IMAGENET_MEAN, IMAGENET_STD


def resize_square(image: np.ndarray, size: int = IMAGE_SIZE) -> np.ndarray:
    """Resizes the shorter side to `size` and centre-crops to a square.

    Wound photos are usually taken with the wound in the middle, so a centre crop keeps it.
    """
    height, width = image.shape[:2]
    scale = size / min(height, width)
    resized = cv2.resize(
        image,
        (max(size, round(width * scale)), max(size, round(height * scale))),
        interpolation=cv2.INTER_AREA if scale < 1 else cv2.INTER_CUBIC,
    )
    h, w = resized.shape[:2]
    top, left = (h - size) // 2, (w - size) // 2
    return resized[top : top + size, left : left + size]


def to_tensor(image: np.ndarray) -> torch.Tensor:
    """RGB uint8 array (H, W, 3) → normalised float tensor (3, H, W)."""
    tensor = torch.from_numpy(np.ascontiguousarray(image)).permute(2, 0, 1).float() / 255.0
    mean = torch.tensor(IMAGENET_MEAN).view(3, 1, 1)
    std = torch.tensor(IMAGENET_STD).view(3, 1, 1)
    return (tensor - mean) / std


def eval_transform(image: np.ndarray) -> torch.Tensor:
    """Deterministic preprocessing used for validation, testing and live assessments."""
    return to_tensor(resize_square(image))


#: Random changes applied to training images only (on uint8 tensors, before normalising).
_augment = v2.Compose(
    [
        v2.RandomResizedCrop(IMAGE_SIZE, scale=(0.6, 1.0), ratio=(0.8, 1.25), antialias=True),
        v2.RandomHorizontalFlip(),
        v2.RandomVerticalFlip(p=0.2),
        v2.RandomRotation(20),
        v2.ColorJitter(brightness=0.25, contrast=0.25, saturation=0.2, hue=0.03),
    ]
)


def train_transform(image: np.ndarray) -> torch.Tensor:
    """Augmented preprocessing for training images."""
    base = resize_square(image, int(IMAGE_SIZE * 1.15))  # a little larger, then random crop
    tensor = torch.from_numpy(np.ascontiguousarray(base)).permute(2, 0, 1)
    augmented = _augment(tensor).permute(1, 2, 0).numpy()
    return to_tensor(augmented)
