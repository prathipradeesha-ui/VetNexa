"""Triage-level evaluation: the planned evaluation from the project poster.

    python -m vetnexa_ai.evaluate_triage --model models/wound-classifier.pt \\
        [--baseline-model models/baseline-resnet18/wound-classifier.pt]

It answers the poster's questions on the held-out test photos:

* **Baselines and ablations** – the same cases are triaged three ways: ``image_only`` (the photo
  alone), ``unweighted`` (photo and answers count equally) and ``reliability`` (the proposed
  reliability-weighted fusion).
* **Scenarios** – every photo is used *clean*, *degraded* (blurred and darker) and *swapped* for an
  unfamiliar image, combined with simulated answers that are *accurate*, *noisy*, *sparse*
  (mostly "not sure") or *absent*.
* **Metrics** – urgent-case sensitivity (primary), cases that needed a vet but were shown as
  routine, under- and over-triage, macro-F1 and accuracy on assessed cases, coverage, the
  risk–coverage curve and its area (AURC), OOD detection (AUROC, FPR at 95 % TPR) and a
  reliability diagram of the photo model's confidence.

**Simulated answers.** No dataset pairs real wound photos with owners' answers yet, so answers
are generated from each photo's true wound type by the documented, seeded protocol in
``SIMULATED_ANSWERS``. The results therefore show whether the *method* behaves as designed; they
are not a measure of clinical performance.

**Ground truth.** The urgency a veterinarian would expect for each wound type (TRUE_OUTCOME):
healthy skin and grazes → routine, cuts and punctures → consultation, abscess or infection →
urgent.
"""

from __future__ import annotations

import argparse
import json
import random
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np
from sklearn.metrics import f1_score, roc_auc_score

from .assessment import Assessor
from .calibration import expected_calibration_error
from .config import CLASSES, QUALITY
from .dataset import Split, read_rgb
from .quality import check_quality
from .symptoms import evaluate_symptoms, parse_answers, questionnaire
from .triage import FUSION_MODES, RANK, fuse, image_evidence, quality_score

TRUE_OUTCOME = {
    "healthy_skin": "ROUTINE",
    "abrasion": "ROUTINE",
    "laceration": "CONSULT",
    "puncture_wound": "CONSULT",
    "abscess_or_infection": "URGENT",
}
OUTCOMES3 = ("ROUTINE", "CONSULT", "URGENT")

#: Typical answers for each wound type (the simulation protocol). Each question is answered
#: with the typical value, replaced by a random option with probability ``noise`` or left
#: "not sure" with probability ``missing``.
SIMULATED_ANSWERS: dict[str, dict] = {
    "healthy_skin": {
        "bodyLocation": "back",
        "duration": "4_7_days",
        "cause": "none_noticed",
        "signs": ["itching"],
        "appetite": "normal",
        "energy": "normal",
        "pain": "none",
    },
    "abrasion": {
        "bodyLocation": "front_leg",
        "duration": "under_24h",
        "cause": "accident",
        "signs": ["red_hot"],
        "appetite": "normal",
        "energy": "normal",
        "pain": "mild",
    },
    "laceration": {
        "bodyLocation": "paw",
        "duration": "under_24h",
        "cause": "sharp_object",
        "signs": ["open_wound", "bleeding"],
        "appetite": "normal",
        "energy": "normal",
        "pain": "mild",
    },
    "puncture_wound": {
        "bodyLocation": "neck",
        "duration": "1_3_days",
        "cause": "bite_fight",
        "signs": ["swelling", "licking"],
        "appetite": "normal",
        "energy": "lower",
        "pain": "mild",
    },
    "abscess_or_infection": {
        "bodyLocation": "back_leg",
        "duration": "4_7_days",
        "cause": "bite_fight",
        "signs": ["swelling", "pus", "bad_smell"],
        "appetite": "less",
        "energy": "lower",
        "pain": "severe",
    },
}

ANSWER_SCENARIOS = {
    "accurate": {"noise": 0.1, "missing": 0.0},
    "noisy": {"noise": 0.4, "missing": 0.0},
    "sparse": {"noise": 0.1, "missing": 0.7},
    "none": None,
}
IMAGE_SCENARIOS = ("clean", "degraded", "unfamiliar")


def simulate_answers(true_class: str, noise: float, missing: float, rng: random.Random) -> dict:
    """Owner answers for a wound of ``true_class`` (see SIMULATED_ANSWERS)."""
    typical = SIMULATED_ANSWERS[true_class]
    answers: dict = {"species": rng.choice(["dog", "cat"]), "redFlags": []}
    for question in questionnaire()["questions"]:
        qid = question["id"]
        options = [o["id"] for o in question["options"]]
        if rng.random() < missing:
            answers[qid] = None
        elif question["type"] == "multiple":
            signs = list(typical[qid])
            if rng.random() < noise:
                signs = rng.sample(options, k=rng.randint(0, 2))
            answers[qid] = signs
        else:
            answers[qid] = rng.choice(options) if rng.random() < noise else typical[qid]
    return answers


def degrade(image: np.ndarray) -> np.ndarray:
    """A blurrier, darker phone photo that still passes the quality gate in most cases."""
    blurred = cv2.GaussianBlur(image, (5, 5), 1.2)
    return np.clip(blurred.astype(np.float32) * 0.62, 0, 255).astype(np.uint8)


def unfamiliar_images(count: int, seed: int, size: int = 320) -> list[np.ndarray]:
    """Procedural images that are not skin or wounds: patterns, gradients, noise, shapes."""
    rng = np.random.default_rng(seed)
    images = []
    for i in range(count):
        kind = i % 4
        if kind == 0:  # checkerboard in two random colours
            cell = int(rng.integers(12, 48))
            a, b = rng.integers(0, 255, 3), rng.integers(0, 255, 3)
            yy, xx = np.mgrid[0:size, 0:size]
            mask = ((yy // cell + xx // cell) % 2).astype(bool)
            img = np.where(mask[..., None], a, b).astype(np.uint8)
        elif kind == 1:  # colour gradient
            ramp = np.linspace(0, 1, size)[None, :, None]
            a, b = rng.integers(0, 255, 3), rng.integers(0, 255, 3)
            img = np.repeat(((1 - ramp) * a + ramp * b), size, axis=0).astype(np.uint8)
        elif kind == 2:  # coloured noise
            img = rng.integers(0, 255, (size, size, 3), dtype=np.uint8)
        else:  # bright geometric shapes on a plain background
            img = np.full((size, size, 3), rng.integers(0, 255, 3), dtype=np.uint8)
            for _ in range(6):
                colour = tuple(int(c) for c in rng.integers(0, 255, 3))
                centre = tuple(int(c) for c in rng.integers(30, size - 30, 2))
                cv2.circle(img, centre, int(rng.integers(10, 60)), colour, -1)
        noise = rng.normal(0, 12, img.shape)
        images.append(np.clip(img + noise, 0, 255).astype(np.uint8))
    return images


@dataclass
class Case:
    true_class: str
    image_scenario: str
    answer_scenario: str
    image: dict | None  # image evidence, or None when the photo failed the quality gate
    symptoms: dict | None


def image_input(assessor: Assessor, image: np.ndarray) -> tuple[dict | None, dict | None]:
    """Image evidence for one photo, plus its OOD result (None if the photo is rejected)."""
    quality = check_quality(image)
    if not quality.ok:
        return None, None
    probabilities, ood = assessor.analyse(image)
    score = quality_score(quality.as_dict(), QUALITY)
    evidence = image_evidence(probabilities, score, ood["familiarity"] if ood else None)
    return evidence, ood


def triage_metrics(truth: list[str], predicted: list[str], reliability: list[float]) -> dict:
    """Safety and accuracy metrics for one fusion mode."""
    truth_a, pred_a = np.array(truth), np.array(predicted)
    assessed = pred_a != "UNABLE"
    t_rank = np.array([RANK[t] for t in truth_a])
    p_rank = np.array([RANK.get(p, -1) for p in pred_a])
    urgent = truth_a == "URGENT"
    needs_vet = truth_a != "ROUTINE"

    def share(mask: np.ndarray, of: np.ndarray) -> float | None:
        return round(float(mask[of].mean()), 4) if of.any() else None

    curve, aurc = risk_coverage(truth_a, pred_a, np.array(reliability))
    return {
        "cases": int(len(truth_a)),
        "coverage": round(float(assessed.mean()), 4),
        "urgent_sensitivity": share(pred_a == "URGENT", urgent),
        "urgent_sent_to_vet": share(pred_a != "ROUTINE", urgent),
        "needs_vet_shown_routine": share(pred_a == "ROUTINE", needs_vet),
        "under_triage": share(p_rank < t_rank, assessed),
        "over_triage": share(p_rank > t_rank, assessed),
        "accuracy_assessed": share(pred_a == truth_a, assessed),
        "macro_f1_assessed": round(
            float(
                f1_score(
                    truth_a[assessed],
                    pred_a[assessed],
                    labels=list(OUTCOMES3),
                    average="macro",
                    zero_division=0,
                )
            ),
            4,
        )
        if assessed.any()
        else None,
        "aurc": aurc,
        "risk_coverage": curve,
    }


def risk_coverage(
    truth: np.ndarray, predicted: np.ndarray, reliability: np.ndarray, points: int = 20
) -> tuple[list[dict], float | None]:
    """Selective risk (error rate among the cases answered) as coverage grows, answering the most
    reliable cases first; AURC is the mean selective risk (lower is better)."""
    assessed = predicted != "UNABLE"
    order = np.argsort(-np.where(assessed, reliability, -1))
    errors = (predicted != truth)[order]
    usable = int(assessed.sum())
    if usable == 0:
        return [], None
    risks = np.cumsum(errors[:usable]) / np.arange(1, usable + 1)
    n = len(truth)
    curve = []
    for k in np.unique(np.linspace(1, usable, min(points, usable)).round().astype(int)):
        curve.append({"coverage": round(k / n, 4), "risk": round(float(risks[k - 1]), 4)})
    return curve, round(float(risks.mean()), 4)


def ood_metrics(id_familiarity: list[float], ood_familiarity: list[float]) -> dict | None:
    if not id_familiarity or not ood_familiarity:
        return None
    ident, ood = np.array(id_familiarity), np.array(ood_familiarity)
    scores = np.concatenate([1 - ident, 1 - ood])  # higher = more unfamiliar
    labels = np.concatenate([np.zeros_like(ident), np.ones_like(ood)])
    threshold95 = np.quantile(ident, 0.05)  # keeps 95 % of familiar photos
    return {
        "familiar_photos": int(len(ident)),
        "unfamiliar_images": int(len(ood)),
        "auroc": round(float(roc_auc_score(labels, scores)), 4),
        "fpr_at_95_tpr": round(float((ood >= threshold95).mean()), 4),
        "flagged_unfamiliar": round(float((ood < 0.5).mean()), 4),
        "familiar_wrongly_flagged": round(float((ident < 0.5).mean()), 4),
    }


def reliability_diagram(probs: np.ndarray, labels: np.ndarray, bins: int = 10) -> list[dict]:
    confidence = probs.max(axis=1)
    correct = probs.argmax(axis=1) == labels
    edges = np.linspace(0, 1, bins + 1)
    out = []
    for low, high in zip(edges[:-1], edges[1:], strict=True):
        in_bin = (confidence > low) & (confidence <= high)
        if in_bin.any():
            out.append(
                {
                    "from": round(float(low), 2),
                    "to": round(float(high), 2),
                    "count": int(in_bin.sum()),
                    "confidence": round(float(confidence[in_bin].mean()), 4),
                    "accuracy": round(float(correct[in_bin].mean()), 4),
                }
            )
    return out


def classifier_summary(assessor: Assessor, images: list[np.ndarray], labels: list[int]) -> dict:
    """Photo-model accuracy, macro-F1, calibration and reliability diagram on clean photos."""
    probs = np.array([[p[c] for c in assessor.classes] for p, _ in map(assessor.analyse, images)])
    y = np.array(labels)
    predicted = probs.argmax(1)
    return {
        "model_version": assessor.version,
        "accuracy": round(float((predicted == y).mean()), 4),
        "macro_f1": round(float(f1_score(y, predicted, average="macro", zero_division=0)), 4),
        "ece": round(expected_calibration_error(probs, y), 4),
        "reliability_diagram": reliability_diagram(probs, y),
    }


def evaluate(
    model_path: Path,
    split_path: Path,
    baseline_path: Path | None = None,
    draws: int = 3,
    seed: int = 7,
    ood_count: int = 60,
) -> dict:
    assessor = Assessor.from_checkpoint(model_path)
    split = Split.load(split_path)
    rng = random.Random(seed)
    photos = [read_rgb(s.path) for s in split.test]
    labels = [s.label for s in split.test]
    unfamiliar = unfamiliar_images(max(ood_count, len(photos)), seed)

    cases: list[Case] = []
    id_familiarity: list[float] = []
    for index, (photo, label) in enumerate(zip(photos, labels, strict=True)):
        true_class = CLASSES[label]
        variants = {
            "clean": photo,
            "degraded": degrade(photo),
            "unfamiliar": unfamiliar[index % len(unfamiliar)],
        }
        evidence = {}
        for name, image in variants.items():
            evidence[name], ood = image_input(assessor, image)
            if name == "clean" and ood:
                id_familiarity.append(ood["familiarity"])
        for answer_name, settings in ANSWER_SCENARIOS.items():
            for _ in range(draws if settings else 1):
                answers = (
                    evaluate_symptoms(
                        parse_answers(simulate_answers(true_class, **settings, rng=rng))
                    )
                    if settings
                    else None
                )
                for image_name in IMAGE_SCENARIOS:
                    cases.append(
                        Case(true_class, image_name, answer_name, evidence[image_name], answers)
                    )

    ood_familiarity = [
        ood["familiarity"]
        for image in unfamiliar[:ood_count]
        for _, ood in [image_input(assessor, image)]
        if ood
    ]

    results: dict = {}
    for mode in FUSION_MODES:
        per_scenario: dict = {}
        truth_all, pred_all, rel_all = [], [], []
        for image_name in IMAGE_SCENARIOS:
            for answer_name in ANSWER_SCENARIOS:
                subset = [
                    c
                    for c in cases
                    if c.image_scenario == image_name and c.answer_scenario == answer_name
                ]
                truth, predicted, reliability = [], [], []
                for case in subset:
                    if case.image is None and case.symptoms is None:
                        outcome, rel = "UNABLE", 0.0  # photo rejected and nothing else to go on
                    else:
                        image = dict(case.image) if case.image else None
                        result = fuse(image, case.symptoms, mode)
                        outcome, rel = result["outcome"], result["reliability"]
                    truth.append(TRUE_OUTCOME[case.true_class])
                    predicted.append(outcome)
                    reliability.append(rel)
                per_scenario[f"{image_name}/{answer_name}"] = triage_metrics(
                    truth, predicted, reliability
                )
                truth_all += truth
                pred_all += predicted
                rel_all += reliability
        results[mode] = {
            "overall": triage_metrics(truth_all, pred_all, rel_all),
            "scenarios": per_scenario,
        }

    report = {
        "model": assessor.version,
        "demo_model": assessor.demo,
        "test_photos": len(photos),
        "cases_per_mode": len(cases),
        "simulated_answers": True,
        "seed": seed,
        "classifier": classifier_summary(assessor, photos, labels),
        "ood": ood_metrics(id_familiarity, ood_familiarity),
        "triage": results,
    }
    if baseline_path:
        baseline = Assessor.from_checkpoint(baseline_path)
        report["baseline_classifier"] = classifier_summary(baseline, photos, labels)
    return report


# ─────────────────────────────── Report output ───────────────────────────────


def pct(value: float | None) -> str:
    return "–" if value is None else f"{value:.1%}"


MODE_LABELS = {
    "image_only": "Image only (baseline)",
    "unweighted": "Unweighted fusion (ablation)",
    "reliability": "Reliability-weighted fusion (proposed)",
}


def to_markdown(report: dict) -> str:
    lines = [
        f"# Triage evaluation – {report['model']}",
        "",
        f"Test photos: **{report['test_photos']}** · cases per method: **{report['cases_per_mode']}**"
        f" · seed {report['seed']}.",
        "",
    ]
    if report["demo_model"]:
        lines += [
            "> **Demonstration model.** These numbers come from a model trained on synthetic "
            "drawings and from simulated owner answers. They show that the method behaves as "
            "designed, not how well it would work on real wounds.",
            "",
        ]
    lines += [
        "## Overall (all scenarios)",
        "",
        "| Method | Urgent sensitivity | Urgent sent to a vet | Needed a vet, shown routine | "
        "Under-triage | Over-triage | Macro-F1 | Coverage | AURC |",
        "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ]
    for mode in FUSION_MODES:
        m = report["triage"][mode]["overall"]
        lines.append(
            f"| {MODE_LABELS[mode]} | {pct(m['urgent_sensitivity'])} | {pct(m['urgent_sent_to_vet'])} | "
            f"{pct(m['needs_vet_shown_routine'])} | {pct(m['under_triage'])} | {pct(m['over_triage'])} | "
            f"{m['macro_f1_assessed'] if m['macro_f1_assessed'] is not None else '–'} | "
            f"{pct(m['coverage'])} | {m['aurc'] if m['aurc'] is not None else '–'} |"
        )
    lines += [
        "",
        "## Missed vet visits by scenario",
        "",
        "Share of cases that needed a veterinarian but were shown as routine care (lower is "
        "better).",
        "",
        "| Photo / answers | " + " | ".join(MODE_LABELS[m] for m in FUSION_MODES) + " |",
        "| --- | " + " | ".join("---" for _ in FUSION_MODES) + " |",
    ]
    for scenario in report["triage"]["reliability"]["scenarios"]:
        row = [
            pct(report["triage"][m]["scenarios"][scenario]["needs_vet_shown_routine"])
            for m in FUSION_MODES
        ]
        lines.append(f"| {scenario} | " + " | ".join(row) + " |")

    lines += [
        "",
        "## Coverage by scenario",
        "",
        "| Photo / answers | " + " | ".join(MODE_LABELS[m] for m in FUSION_MODES) + " |",
        "| --- | " + " | ".join("---" for _ in FUSION_MODES) + " |",
    ]
    for scenario in report["triage"]["reliability"]["scenarios"]:
        row = [pct(report["triage"][m]["scenarios"][scenario]["coverage"]) for m in FUSION_MODES]
        lines.append(f"| {scenario} | " + " | ".join(row) + " |")

    ood = report["ood"]
    if ood:
        lines += [
            "",
            "## Out-of-distribution detection",
            "",
            "| Measure | Value |",
            "| --- | --- |",
            f"| AUROC (familiar test photos vs {ood['unfamiliar_images']} unfamiliar images) | {ood['auroc']:.3f} |",
            f"| FPR at 95 % TPR | {pct(ood['fpr_at_95_tpr'])} |",
            f"| Unfamiliar images flagged at the app's threshold | {pct(ood['flagged_unfamiliar'])} |",
            f"| Familiar photos wrongly flagged | {pct(ood['familiar_wrongly_flagged'])} |",
        ]

    lines += [
        "",
        "## Photo model",
        "",
        "| Model | Accuracy | Macro-F1 | ECE |",
        "| --- | --- | --- | --- |",
    ]
    for key in ("classifier", "baseline_classifier"):
        if key in report:
            c = report[key]
            lines.append(
                f"| {c['model_version']} | {pct(c['accuracy'])} | {c['macro_f1']:.3f} | {c['ece']:.3f} |"
            )
    lines += [
        "",
        "Charts: `risk-coverage.svg` (selective risk as coverage grows, one panel per method) and "
        "`reliability-diagram.svg` (photo-model confidence vs accuracy).",
        "",
        "## Method",
        "",
        "Every test photo is triaged clean, degraded (blurred and 38 % darker) and swapped for an "
        "unfamiliar image, each with simulated answers that are accurate (10 % random answers), "
        'noisy (40 %), sparse (70 % "not sure") or absent. Ground truth: healthy skin and grazes '
        "→ routine; cuts and punctures → consultation; abscess or infection → urgent. AURC "
        "orders assessed cases by overall reliability.",
    ]
    return "\n".join(lines) + "\n"


FONT = 'font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif"'


def svg_risk_coverage(report: dict) -> str:
    """Three small panels (one per method, one hue), so no colour is needed to tell them apart.

    x: coverage (share of cases answered, most reliable first); y: selective risk (error rate).
    """
    panel_w, top, plot_h, left = 230, 40, 130, 30
    plot_w = panel_w - left - 14
    panels = []
    for i, mode in enumerate(FUSION_MODES):
        m = report["triage"][mode]["overall"]
        x0 = i * panel_w

        def x(cov: float, x0: int = x0) -> float:
            return x0 + left + cov * plot_w

        def y(risk: float) -> float:
            return top + (1 - risk) * plot_h

        pts = " ".join(f"{x(p['coverage']):.1f},{y(p['risk']):.1f}" for p in m["risk_coverage"])
        grid = "".join(
            f'<line x1="{x(0)}" y1="{y(v)}" x2="{x(1)}" y2="{y(v)}" stroke="#e3eaed"/>'
            f'<text x="{x(0) - 5}" y="{y(v) + 3}" font-size="9" text-anchor="end" fill="#4a5b73">{v:g}</text>'
            for v in (0, 0.5, 1)
        )
        ticks = "".join(
            f'<text x="{x(v)}" y="{top + plot_h + 13}" font-size="9" text-anchor="middle" fill="#4a5b73">{v:g}</text>'
            for v in (0, 0.5, 1)
        )
        aurc = "–" if m["aurc"] is None else f"{m['aurc']:.3f}"
        panels.append(
            f'<g><text x="{x0 + left}" y="14" font-size="11" font-weight="700" fill="#13294b">{MODE_LABELS[mode]}</text>'
            f'<text x="{x0 + left}" y="28" font-size="10" fill="#4a5b73">AURC {aurc} · coverage {m["coverage"]:.0%}</text>'
            f"{grid}{ticks}"
            f'<polyline points="{pts}" fill="none" stroke="#0a6c6c" stroke-width="2" stroke-linejoin="round"/>'
            f'<text x="{x(0.5)}" y="{top + plot_h + 26}" font-size="9" text-anchor="middle" fill="#4a5b73">coverage</text></g>'
        )
    height = top + plot_h + 32
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {3 * panel_w} {height}" {FONT} role="img" '
        'aria-label="Selective risk (error rate) against coverage for each triage method">'
        f'<rect width="100%" height="100%" fill="#ffffff"/>{"".join(panels)}</svg>\n'
    )


def svg_reliability_diagram(report: dict) -> str:
    bins = report["classifier"]["reliability_diagram"]
    size, pad = 260, 34
    scale = size - pad - 10
    bars = []
    for b in bins:
        x = pad + b["from"] * scale
        w = (b["to"] - b["from"]) * scale - 2
        h = b["accuracy"] * scale
        bars.append(
            f'<rect x="{x:.1f}" y="{10 + scale - h:.1f}" width="{w:.1f}" height="{h:.1f}" rx="2" fill="#0a6c6c">'
            f"<title>{b['from']:.1f}–{b['to']:.1f}: accuracy {b['accuracy']:.0%}, {b['count']} photos</title></rect>"
        )
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size + 16}" {FONT} role="img" '
        'aria-label="Reliability diagram: accuracy of the photo model in each confidence band">'
        '<rect width="100%" height="100%" fill="#ffffff"/>'
        f'<line x1="{pad}" y1="{10 + scale}" x2="{pad + scale}" y2="10" stroke="#6b7a8f" stroke-dasharray="4 4"/>'
        + "".join(bars)
        + "".join(
            f'<text x="{pad + v * scale}" y="{10 + scale + 12}" font-size="9" text-anchor="middle" fill="#4a5b73">{v:g}</text>'
            f'<text x="{pad - 5}" y="{10 + (1 - v) * scale + 3}" font-size="9" text-anchor="end" fill="#4a5b73">{v:g}</text>'
            for v in (0, 0.5, 1)
        )
        + f'<line x1="{pad}" y1="{10 + scale}" x2="{pad + scale}" y2="{10 + scale}" stroke="#c3d1d6"/>'
        f'<text x="{pad + scale / 2}" y="{size + 10}" font-size="10" text-anchor="middle" fill="#4a5b73">confidence → (dashed line = perfect calibration)</text>'
        f'<text x="12" y="{10 + scale / 2}" font-size="10" fill="#4a5b73" transform="rotate(-90 12 {10 + scale / 2})" text-anchor="middle">accuracy</text>'
        "</svg>\n"
    )


def write_report(report: dict, report_dir: Path) -> None:
    report_dir.mkdir(parents=True, exist_ok=True)
    (report_dir / "triage-evaluation.json").write_text(
        json.dumps(report, indent=2), encoding="utf-8"
    )
    (report_dir / "triage-evaluation.md").write_text(to_markdown(report), encoding="utf-8")
    (report_dir / "risk-coverage.svg").write_text(svg_risk_coverage(report), encoding="utf-8")
    (report_dir / "reliability-diagram.svg").write_text(
        svg_reliability_diagram(report), encoding="utf-8"
    )


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(
        description="Evaluate triage methods (poster evaluation plan)."
    )
    parser.add_argument("--model", default="models/wound-classifier.pt")
    parser.add_argument("--split", default="models/split.json")
    parser.add_argument("--baseline-model", help="optional second checkpoint, e.g. ResNet-18")
    parser.add_argument("--report-dir", default="reports")
    parser.add_argument("--draws", type=int, default=3, help="answer simulations per photo")
    parser.add_argument("--seed", type=int, default=7)
    args = parser.parse_args(argv)
    report = evaluate(
        Path(args.model),
        Path(args.split),
        Path(args.baseline_model) if args.baseline_model else None,
        args.draws,
        args.seed,
    )
    write_report(report, Path(args.report_dir))
    summary = {
        m: {
            k: report["triage"][m]["overall"][k]
            for k in ("urgent_sensitivity", "needs_vet_shown_routine", "coverage", "aurc")
        }
        for m in FUSION_MODES
    }
    print(json.dumps({"ood": report["ood"], "triage": summary}, indent=2))


if __name__ == "__main__":
    main()
