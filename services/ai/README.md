# VetNexa AI service

Python package for the **AI wound assessment**: image quality checks (OpenCV), a transfer-learning
classifier (PyTorch, EfficientNet-B0 with a ResNet-18 baseline), calibrated confidence,
an unfamiliar-photo (OOD) check, symptom questions and reliability-weighted triage.

> The wound assessment is a **decision-support prototype**, not a diagnostic tool. See the
> [model card](../../docs/ai-model.md) for intended use and limitations, the
> [AI evaluation report](../../docs/ai-evaluation-report.md) for results, and the
> [setup guide](../../docs/setup-guide.md) for running the whole platform.

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

# 3. Triage evaluation: baselines, ablation, risk–coverage, OOD (see docs/evaluation.md)
python -m vetnexa_ai.evaluate_triage --model models/wound-classifier.pt

# Two-stage training (e.g. human wound photos first, then dog and cat photos)
python -m vetnexa_ai.train --data-dir data/human-wounds --output-dir models/stage1
python -m vetnexa_ai.train --data-dir data/wounds --init-from models/stage1/wound-classifier.pt
```

### Skin-condition check (advisory)

A second model suggests which common skin condition a photo most resembles (healthy,
ringworm, mange, other fungal infection, dermatitis). It is trained only on the curated real
dog and cat photos (see `datasets/README.md`) and is advisory: it never changes the triage.

```bash
# Build data/skin-conditions/<class>/ from the verified and community collections
python -m vetnexa_ai.skin_dataset

# Train with the same script, choosing the classes, output file and model name
python -m vetnexa_ai.train --data-dir data/skin-conditions     --classes healthy,ringworm,mange,fungal_infection,dermatitis     --output-dir models/skin --model-file skin-classifier.pt --task skin --epochs 20

# Evaluate on its own test split; writes reports/skin-evaluation.json and .md
python -m vetnexa_ai.evaluate --model models/skin/skin-classifier.pt     --split models/skin/split.json --report-name skin-evaluation
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
| `VETNEXA_SKIN_MODEL` | `models/skin/skin-classifier.pt` | Advisory skin-condition checkpoint; optional |
| `VETNEXA_AI_TOKEN` | – | Shared secret; the API must send the same value (`AI_SERVICE_TOKEN`) |
| `VETNEXA_AI_HOST` / `VETNEXA_AI_PORT` | `127.0.0.1` / `8000` | Where to listen |

`GET /health` reports whether a model is loaded and whether it is a demo model;
`POST /assess` takes the raw image bytes and returns the assessment; `POST /chat` answers a
pet-care question from the knowledge base in `knowledge/` (see `docs/assistant.md`). Without a checkpoint the
service still starts and `/assess` answers `503`. When a skin model is loaded, every photo that
passes the quality checks also gets a `skinCheck` (status `SUGGESTED`, `UNSURE` below 55%
confidence, or `UNFAMILIAR` when the photo looks unlike the training photos); otherwise
`skinCheck` is `null`.

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
| `model.py` | EfficientNet-B0 (default) or ResNet-18 with a new head; saving and loading checkpoints with metadata |
| `calibration.py` | Temperature scaling (only ever softens confidence) and calibration error |
| `train.py` | Two-phase training, class weighting, early stopping, calibration |
| `evaluate.py` | Test metrics, confusion matrix, coverage and under-triage rate (skin model: suggestion rate and unfamiliar photos) |
| `skin_dataset.py` | Builds the skin-condition training folder from the curated photo collections |
| `skin_check.py` | Advisory skin-condition check added to each assessment |
| `curation.py` / `review_sheets.py` | Curating the real photo collections; contact sheets for visual review |
| `assessment.py` | Safety rules and the `Assessor` used by the inference API |
| `questionnaire.json` | Symptom questions, red flags, weighted rules and thresholds (vet-reviewable) |
| `symptoms.py` | Validates answers and turns them into rule-weighted symptom evidence |
| `chat/` | Pet-care assistant: knowledge loading, safety triage, TF-IDF retrieval, replies |
| `service.py` | FastAPI inference service (`/health`, `/assess`) used by the Node API |
| `triage.py` | Reliability-weighted fusion, four outcomes and safety overrides |
| `ood.py` | Out-of-distribution detector (energy score and Mahalanobis distance) |
| `evaluate_triage.py` | Poster evaluation: baselines, scenarios, sensitivity, risk–coverage, OOD |
| `synthetic.py` | Synthetic drawings for automated tests |

## Tests and code quality

```bash
pytest            # includes an end-to-end train → evaluate → assess run
ruff check .
ruff format .
```
