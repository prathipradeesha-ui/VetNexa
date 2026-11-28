# VetNexa Wound Assessment – Model Card

|           |                                                                                                                                        |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Model     | `wound-efficientnetb0` – EfficientNet-B0 pre-trained on ImageNet, fine-tuned for 5 classes (ResNet-18 kept as the comparison baseline) |
| Status    | **Research prototype. Not validated for clinical use.**                                                                                |
| Developer | Pradeesha Baskaran                                                                                                                     |
| Code      | `services/ai/vetnexa_ai`                                                                                                               |

## Intended use

- Give dog and cat owners a **preliminary, cautious** indication of what a visible skin wound
  may be and how urgently a veterinarian should see it.
- Encourage owners to seek veterinary care earlier, never to delay it.

## Out of scope

- Diagnosis, prescribing or replacing an examination by a veterinarian.
- Internal injuries, fractures, eye injuries, burns, or species other than dogs and cats.
- Naming skin diseases. A separate, advisory skin-condition check (below) suggests the closest
  common condition, but it never changes the triage.
- Emergency triage. The app tells owners to contact a clinic immediately for heavy bleeding,
  breathing difficulty or collapse, whatever the model says.

## Classes and severity

| Class                  | Shown to owner as                    | Base severity | Always refer to a vet |
| ---------------------- | ------------------------------------ | ------------- | --------------------- |
| `abrasion`             | a graze or abrasion                  | Minor         | No                    |
| `laceration`           | a cut (laceration)                   | Moderate      | Yes                   |
| `puncture_wound`       | a puncture wound, such as a bite     | Moderate      | Yes                   |
| `abscess_or_infection` | a possible abscess or infected wound | Severe        | Yes                   |
| `healthy_skin`         | no obvious wound                     | Minor         | No                    |

The class list, severities and guidance text are clinical decisions. They should be reviewed by
a veterinarian before any real-world use.

## How a photo is assessed

1. **Quality gate (OpenCV).** Photos that are blurry (variance of the Laplacian below 60), too
   dark or bright, mostly black or white, or smaller than 224 px are rejected with advice on how
   to retake them. Nothing is predicted for them.
2. **Model.** The photo is resized and centre-cropped to 224 × 224 and classified.
3. **Calibration.** Scores are divided by a temperature _T_ fitted on the validation set so that
   stated confidence matches accuracy. _T_ is never below 1, so calibration can only lower
   confidence.
4. **Safety rules.**
   - Confidence below **60 %** → result is **Uncertain** and the owner is advised to see a vet.
   - If a more serious class still has **≥ 25 %** probability, severity is **raised** to it.
   - Cuts, punctures and infections always recommend a vet.
   - Every result carries a disclaimer and the word "diagnosis" is never used for AI output.

## Multimodal input: symptoms and context

The photo is the first input. The second is a short questionnaire the owner answers before
uploading it (`services/ai/vetnexa_ai/questionnaire.json`, `symptoms.py`):

- **Red flags.** Eight emergency signs (heavy bleeding, breathing difficulty, collapse, a very
  deep or penetrating wound, a road accident or fall, an eye injury, rapid facial swelling or a
  possible snake bite, a seizure). Ticking one shows an emergency notice at once, and the
  result is always urgent, even when the photo is too poor to assess.
- **Symptoms and context.** Body location, duration, cause, visible signs, appetite, energy and
  pain. Every question has a "Not sure" answer.
- **Rule-weighted evidence.** 23 documented rules each add a weight; weights combine as a
  noisy-OR, `risk = 1 − Π(1 − wᵢ)`. Below 0.25 the symptoms suggest routine care, from 0.25 a
  veterinary consultation, and from 0.60 urgent attention.
- **Missing inputs.** Unanswered questions are listed and lower the completeness score, which
  Stage 20 uses as the reliability of this evidence.

The questions, weights and thresholds are a developer draft and must be reviewed by a
veterinarian.

## Out-of-distribution (OOD) detection

A classifier always picks one of its classes, even for a photo of a sofa or a human hand.
`ood.py` checks whether a photo looks like the photos the model was trained on, using two
signals fitted after training and stored in the checkpoint:

- **Energy score** of the logits (Liu et al., 2020): familiar photos have low energy.
- **Mahalanobis distance** of the EfficientNet feature vector to the nearest class centre, with
  a Ledoit–Wolf shared covariance (Lee et al., 2018).

Each threshold is the 97.5th percentile on the validation photos. The scores become a
familiarity between 0 and 1 (0.5 at the threshold); below 0.5 the photo is treated as
unfamiliar and **not used** – the decision then rests on the answers, or the system abstains.

## Reliability-weighted evidence fusion and triage

`triage.py` turns both inputs into one of **four outcomes**: routine care / monitor,
veterinary consultation recommended, urgent veterinary attention, or **unable to assess
safely**.

| Input    | Risk                                                 | Reliability                                     |
| -------- | ---------------------------------------------------- | ----------------------------------------------- |
| Photo    | Σ p(class) × class risk (0.05 healthy … 0.8 abscess) | quality × familiarity × (0.5 + 0.5 × certainty) |
| Symptoms | noisy-OR of the triggered rules                      | share of questions answered                     |

- **Fusion:** `risk = Σ rᵢ·riskᵢ / Σ rᵢ`; overall reliability `1 − Π(1 − rᵢ)`. Below 0.25 →
  routine, from 0.25 → consultation, from 0.60 → urgent.
- **Safe abstention:** overall reliability below 0.35 → unable to assess safely.
- **Safety overrides:** red flags → urgent; a reliable input (r ≥ 0.5) saying "see a vet" can
  never end as routine, and its "urgent" can drop at most to a consultation; a reliable photo of
  a cut, puncture or infection always refers; weak evidence that points to urgency is urgent,
  not "unable".
- **Explanation:** every result stores each input's risk, reliability and weight, the overrides
  and the OOD result; owners see them under "Why this result".
- **Baselines for the evaluation:** the same function runs in `image_only` and `unweighted`
  modes, so Stage 21 can compare them with reliability weighting.

## How it is used in VetNexa

The model runs in a separate Python service (`python -m vetnexa_ai.service`). Owners upload a
photo of their dog or cat in **Wound check**; the API forwards it, stores the result with the
model version, and the web app shows the severity, calibrated confidence (hidden for uncertain
results), guidance, a vet referral with links to clinics and consultations, the probability of
each class, an emergency notice and the disclaimer. Results from a model trained with `--demo`
(synthetic images) are labelled as demonstration results on every screen.

## Training method

- Transfer learning: frozen backbone for the first epochs, then full fine-tuning at a lower
  learning rate.
- Augmentation: random crops, flips, rotations up to 20° and colour jitter.
- Class-weighted cross-entropy with label smoothing (0.05), so rare wound types are not ignored.
- Model selection by validation **macro-F1** with early stopping.
- Optional two-stage training: human wound photos first, then dog and cat photos.

## Data and split

- Train / validation / test ≈ 70 / 15 / 15 %, stratified by class.
- **Group-aware:** all photos of the same wound stay in one split, so the test score is not
  inflated by near-duplicates. Exact duplicate files are removed.
- The split is saved to `models/split.json` and evaluation always uses the same test images.

**Data policy: verified original data only** (decided 21 November 2026). Only images published
by the people who took them, or supplied directly by a clinic with owner consent, are used.
About 25 public sources were researched; community uploads on Kaggle and Roboflow were inspected
and rejected because they contain stock-watermarked and website photos, re-licensed copies of
other datasets and augmented images. The full record, with a manifest and SHA-256 fingerprint
for every image, is in `services/ai/datasets/`.

| Source                                     | Content                                                                                      | Status                     |
| ------------------------------------------ | -------------------------------------------------------------------------------------------- | -------------------------- |
| Mendeley 10.17632/5dbht54kw7.1 (CC BY 4.0) | Clinical skin photos of 62 dogs: 26 healthy, 13 allergic dermatitis, 12 bacterial, 11 fungal | In use                     |
| PetWound (Animals 2023, 13(6), 956)        | 290 photos of real wounds: 208 dogs, 82 cats                                                 | Requested from the authors |
| Partner veterinary clinic                  | Wound photos with owner consent                                                              | Requested                  |

**Status of the wound model:** none of the verified data yet contains labelled wound types, so
the wound classifier has not been trained on real data. The pipeline is complete and tested,
and training will run as soon as PetWound or clinic images are received and labelled by a
veterinarian.

## Evaluation

`python -m vetnexa_ai.evaluate` writes `reports/evaluation.md` with:

| Measure                                             | Why it matters                                                                                  |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Accuracy, balanced accuracy, macro-F1               | Overall performance, fair to rare classes                                                       |
| Per-class precision and recall, confusion matrix    | Which wound types are confused                                                                  |
| Expected calibration error before and after scaling | Whether the confidence shown is honest                                                          |
| Coverage and accuracy when answered                 | How often the model answers instead of "uncertain"                                              |
| **Under-triage rate**                               | How often a moderate or severe wound would be shown as minor – the most important safety number |

Triage-level evaluation (baselines, ablation, risk–coverage, OOD, calibration): see
[evaluation.md](evaluation.md), and the final results in the
[AI evaluation report](ai-evaluation-report.md). Results on real wounds: _to be completed after
training on real data._ Results on synthetic test images are reported there only to show that
the method works as designed; they say nothing about real wounds.

## Known limitations and risks

- **Small data.** Verified dog and cat wound data is scarce (a few hundred images at best), so
  performance estimates will have wide uncertainty and may not generalise.
- **Bias.** Coat colour, breed, hair length, lighting and phone camera can all affect results.
  Dark-coated animals and dark skin are likely under-represented.
- **Single photo.** Depth, smell, heat, pain and the animal's behaviour are invisible in a photo
  but matter clinically.
- **Domain shift.** Human wound photos used for pre-training differ from animal skin and fur.
- **Labels.** Wound type from a photo is sometimes ambiguous even for veterinarians.

## Companion model: advisory skin-condition check

|              |                                                                                                                            |
| ------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Model        | `skin-efficientnetb0` – EfficientNet-B0, same training script, calibration and OOD detector                                |
| Classes      | Healthy skin, ringworm, mange or scabies, other fungal infection, dermatitis (allergic, flea allergy, bacterial, hot spot) |
| Data         | 767 real, curated dog and cat photos from the verified and community collections; split 547 / 110 / 110                    |
| Test results | Accuracy 67.3 %, macro-F1 0.621, ECE 0.076; suggests a condition for 68 % of photos and is right 77 % of the time then     |
| Output       | `SUGGESTED` (confidence ≥ 0.55), `UNSURE`, or `UNFAMILIAR` (OOD); advice per condition                                     |

It runs on every photo that passes the quality checks and is shown below the main result as
"advisory". It never changes the triage outcome, because its accuracy is too low to rely on:
ringworm, other fungal infections and dermatitis are often confused, and vets normally confirm
them with a skin scrape or culture. Labels come from the photo sources, not from a vet. Full
results: [AI evaluation report, section 5.5](ai-evaluation-report.md).

## Before any clinical use

A prospective study comparing the model with veterinarians on new cases, review of the classes
and guidance by veterinary professionals, monitoring of under-triage in use, and the relevant
ethical and regulatory approvals would all be required.
