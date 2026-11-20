# VetNexa AI service

Python package for the **AI wound assessment**: image quality checks (OpenCV), a transfer-learning
classifier (PyTorch, ResNet-18), calibrated confidence and cautious safety rules.

> The wound assessment is a **decision-support prototype**, not a diagnostic tool. See the
> [model card](../../docs/ai-model.md) for intended use, evaluation and limitations.

## Setup

Python 3.11 or newer.

```bash
cd services/ai
python -m venv .venv
.venv/Scripts/activate          # Windows (macOS/Linux: source .venv/bin/activate)
pip install -r requirements-dev.txt
```

## Pipeline

```bash
# 1. Put images in data/wounds/<class>/ (see data/README.md), then train.
python -m vetnexa_ai.train --data-dir data/wounds --epochs 25

# 2. Evaluate on the held-out test split; writes reports/evaluation.json and .md
python -m vetnexa_ai.evaluate --model models/wound-classifier.pt

# Two-stage training (e.g. human wound photos first, then dog and cat photos)
python -m vetnexa_ai.train --data-dir data/human-wounds --output-dir models/stage1
python -m vetnexa_ai.train --data-dir data/wounds --init-from models/stage1/wound-classifier.pt
```

To try the pipeline without real photos, generate synthetic drawings (only for testing the code,
never for real use):

```bash
python -m vetnexa_ai.synthetic --out data/synthetic --per-class 60
python -m vetnexa_ai.train --data-dir data/synthetic --output-dir models/synthetic --epochs 6
```

## Package layout

| Module | Purpose |
| --- | --- |
| `config.py` | Classes, severity per class, owner guidance, quality limits, safety thresholds |
| `quality.py` | Decoding uploads and rejecting blurry, dark, washed-out or tiny photos |
| `preprocessing.py` | Resize and normalise for the model; augmentation for training |
| `dataset.py` | Finding images, removing duplicates, group-aware train/val/test split |
| `model.py` | ResNet-18 with a new head; saving and loading checkpoints with metadata |
| `calibration.py` | Temperature scaling (only ever softens confidence) and calibration error |
| `train.py` | Two-phase training, class weighting, early stopping, calibration |
| `evaluate.py` | Test metrics, confusion matrix, coverage and under-triage rate |
| `assessment.py` | Safety rules and the `Assessor` used by the inference API |
| `synthetic.py` | Synthetic drawings for automated tests |

## Tests and code quality

```bash
pytest            # 27 tests, including an end-to-end train → evaluate → assess run
ruff check .
ruff format .
```
