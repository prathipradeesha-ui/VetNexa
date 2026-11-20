"""Evaluation on the held-out test set, written to reports/evaluation.json and .md.

    python -m vetnexa_ai.evaluate --model models/wound-classifier.pt

Besides ordinary accuracy, it reports what matters for safety:
- per-class precision and recall, and the confusion matrix (which wound types get mixed up);
- calibration error before and after temperature scaling (is the stated confidence honest?);
- coverage: how often the model gives an answer instead of "uncertain", and its accuracy then;
- under-triage: how often a moderate or severe wound would be shown to the owner as minor.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import torch
from sklearn.metrics import (
    accuracy_score,
    balanced_accuracy_score,
    confusion_matrix,
    precision_recall_fscore_support,
)
from torch.utils.data import DataLoader

from .assessment import apply_safety_rules
from .calibration import expected_calibration_error
from .config import CLASS_SEVERITY, SAFETY
from .dataset import Split, WoundDataset
from .model import load_checkpoint
from .preprocessing import eval_transform
from .train import predict_logits


def evaluate(model_path: Path, split_path: Path, report_dir: Path) -> dict:
    model, checkpoint = load_checkpoint(model_path)
    classes: list[str] = checkpoint["classes"]
    split = Split.load(split_path)
    loader = DataLoader(WoundDataset(split.test, eval_transform), batch_size=32)
    logits, labels_t = predict_logits(model, loader, "cpu")
    labels = labels_t.numpy()

    raw = torch.softmax(logits, 1).numpy()
    probs = torch.softmax(logits / checkpoint["temperature"], 1).numpy()
    predicted = probs.argmax(1)

    precision, recall, f1, support = precision_recall_fscore_support(
        labels, predicted, labels=range(len(classes)), zero_division=0
    )

    # Run every test image through the same safety rules the app uses.
    decisions = [apply_safety_rules(dict(zip(classes, map(float, p), strict=True))) for p in probs]
    answered = np.array([d["status"] == "ASSESSED" for d in decisions])
    serious = np.array([CLASS_SEVERITY[classes[y]] in ("MODERATE", "SEVERE") for y in labels])
    shown_minor = np.array([d["severity"] == "MINOR" for d in decisions])

    report = {
        "model_version": checkpoint["version"],
        "test_images": int(len(labels)),
        "accuracy": round(float(accuracy_score(labels, predicted)), 4),
        "balanced_accuracy": round(float(balanced_accuracy_score(labels, predicted)), 4),
        "macro_f1": round(float(f1.mean()), 4),
        "per_class": {
            name: {
                "precision": round(float(precision[i]), 4),
                "recall": round(float(recall[i]), 4),
                "f1": round(float(f1[i]), 4),
                "support": int(support[i]),
            }
            for i, name in enumerate(classes)
        },
        "confusion_matrix": {
            "labels": classes,
            "rows_true_cols_predicted": confusion_matrix(
                labels, predicted, labels=range(len(classes))
            ).tolist(),
        },
        "calibration": {
            "temperature": round(float(checkpoint["temperature"]), 3),
            "ece_before": round(expected_calibration_error(raw, labels), 4),
            "ece_after": round(expected_calibration_error(probs, labels), 4),
        },
        "safety": {
            "min_confidence": SAFETY.min_confidence,
            "coverage": round(float(answered.mean()), 4),
            "accuracy_when_answered": round(
                float((predicted[answered] == labels[answered]).mean()) if answered.any() else 0.0,
                4,
            ),
            "serious_cases": int(serious.sum()),
            "under_triage_rate": round(
                float((serious & shown_minor).sum() / serious.sum()) if serious.any() else 0.0, 4
            ),
        },
        "training": {k: v for k, v in checkpoint["metrics"].items() if k != "history"},
        "data_summary": checkpoint["data_summary"],
    }

    report_dir.mkdir(parents=True, exist_ok=True)
    (report_dir / "evaluation.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    (report_dir / "evaluation.md").write_text(to_markdown(report), encoding="utf-8")
    return report


def to_markdown(report: dict) -> str:
    """Readable version of the report for the project documentation."""
    lines = [
        f"# Evaluation – {report['model_version']}",
        "",
        f"Test images: **{report['test_images']}** (never seen during training or tuning).",
        "",
        "| Metric | Value |",
        "| --- | --- |",
        f"| Accuracy | {report['accuracy']:.1%} |",
        f"| Balanced accuracy | {report['balanced_accuracy']:.1%} |",
        f"| Macro F1 | {report['macro_f1']:.3f} |",
        f"| Calibration error (ECE) before → after | {report['calibration']['ece_before']:.3f} → "
        f"{report['calibration']['ece_after']:.3f} |",
        f"| Coverage (answered, not 'uncertain') | {report['safety']['coverage']:.1%} |",
        f"| Accuracy when answered | {report['safety']['accuracy_when_answered']:.1%} |",
        f"| Under-triage (serious shown as minor) | {report['safety']['under_triage_rate']:.1%} "
        f"of {report['safety']['serious_cases']} |",
        "",
        "## Per class",
        "",
        "| Class | Precision | Recall | F1 | Test images |",
        "| --- | --- | --- | --- | --- |",
    ]
    for name, m in report["per_class"].items():
        scores = f"{m['precision']:.2f} | {m['recall']:.2f} | {m['f1']:.2f}"
        lines.append(f"| {name} | {scores} | {m['support']} |")
    labels = report["confusion_matrix"]["labels"]
    lines += [
        "",
        "## Confusion matrix (rows: true class, columns: predicted)",
        "",
        "| | " + " | ".join(labels) + " |",
        "|---" * (len(labels) + 1) + "|",
    ]
    for name, row in zip(
        labels, report["confusion_matrix"]["rows_true_cols_predicted"], strict=True
    ):
        lines.append(f"| **{name}** | " + " | ".join(map(str, row)) + " |")
    return "\n".join(lines) + "\n"


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Evaluate the wound classifier on the test set.")
    parser.add_argument("--model", default="models/wound-classifier.pt")
    parser.add_argument("--split", default="models/split.json")
    parser.add_argument("--report-dir", default="reports")
    args = parser.parse_args()
    result = evaluate(Path(args.model), Path(args.split), Path(args.report_dir))
    print(json.dumps({k: result[k] for k in ("accuracy", "macro_f1", "safety")}, indent=2))
