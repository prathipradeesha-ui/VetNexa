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

## Inference service

The Node API calls this service to assess photos. Start it with:

```bash
python -m vetnexa_ai.service          # http://127.0.0.1:8000
```

| Variable | Default | Meaning |
| --- | --- | --- |
| `VETNEXA_AI_MODEL` | `models/wound-classifier.pt` | Checkpoint to load |
| `VETNEXA_AI_TOKEN` | – | Shared secret; the API must send the same value (`AI_SERVICE_TOKEN`) |
| `VETNEXA_AI_HOST` / `VETNEXA_AI_PORT` | `127.0.0.1` / `8000` | Where to listen |

`GET /health` reports whether a model is loaded and whether it is a demo model;
`POST /assess` takes the raw image bytes and returns the assessment; `POST /chat` answers a
pet-care question from the knowledge base in `knowledge/` (see `docs/assistant.md`). Without a checkpoint the
service still starts and `/assess` answers `503`.

**Demo model.** Until real veterinary data is available, the feature can be demonstrated with
a model trained on synthetic drawings. Train it with `--demo` so the checkpoint is marked; the
API stores `demoModel: true` with each result and the web app shows a warning on every page:

```bash
python -m vetnexa_ai.train --data-dir data/synthetic --output-dir models --epochs 6 --demo
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
| `questionnaire.json` | Symptom questions, red flags, weighted rules and thresholds (vet-reviewable) |
| `symptoms.py` | Validates answers and turns them into rule-weighted symptom evidence |
| `chat/` | Pet-care assistant: knowledge loading, safety triage, TF-IDF retrieval, replies |
| `service.py` | FastAPI inference service (`/health`, `/assess`) used by the Node API |
| `synthetic.py` | Synthetic drawings for automated tests |

## Tests and code quality

```bash
pytest            # 96 tests, including an end-to-end train → evaluate → assess run
ruff check .
ruff format .
```
