# VetNexa Wound Assessment – Model Card

|           |                                                                                |
| --------- | ------------------------------------------------------------------------------ |
| Model     | `wound-resnet18` – ResNet-18 pre-trained on ImageNet, fine-tuned for 5 classes |
| Status    | **Research prototype. Not validated for clinical use.**                        |
| Developer | Pradeesha Baskaran                                                             |
| Code      | `services/ai/vetnexa_ai`                                                       |

## Intended use

- Give dog and cat owners a **preliminary, cautious** indication of what a visible skin wound
  may be and how urgently a veterinarian should see it.
- Encourage owners to seek veterinary care earlier, never to delay it.

## Out of scope

- Diagnosis, prescribing or replacing an examination by a veterinarian.
- Internal injuries, fractures, eye injuries, burns, skin diseases, or species other than dogs
  and cats.
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

Dataset: _to be completed once the training data is chosen_ (sources, licences, number of images
per class, how labels were checked). See `services/ai/data/README.md`.

## Evaluation

`python -m vetnexa_ai.evaluate` writes `reports/evaluation.md` with:

| Measure                                             | Why it matters                                                                                  |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Accuracy, balanced accuracy, macro-F1               | Overall performance, fair to rare classes                                                       |
| Per-class precision and recall, confusion matrix    | Which wound types are confused                                                                  |
| Expected calibration error before and after scaling | Whether the confidence shown is honest                                                          |
| Coverage and accuracy when answered                 | How often the model answers instead of "uncertain"                                              |
| **Under-triage rate**                               | How often a moderate or severe wound would be shown as minor – the most important safety number |

Results: _to be completed after training on real data._ Results from synthetic test images are
not reported because they say nothing about real wounds.

## Known limitations and risks

- **Small data.** Openly licensed dog and cat wound datasets contain only a few hundred images,
  so performance estimates will have wide uncertainty and may not generalise.
- **Bias.** Coat colour, breed, hair length, lighting and phone camera can all affect results.
  Dark-coated animals and dark skin are likely under-represented.
- **Single photo.** Depth, smell, heat, pain and the animal's behaviour are invisible in a photo
  but matter clinically.
- **Domain shift.** Human wound photos used for pre-training differ from animal skin and fur.
- **Labels.** Wound type from a photo is sometimes ambiguous even for veterinarians.

## Before any clinical use

A prospective study comparing the model with veterinarians on new cases, review of the classes
and guidance by veterinary professionals, monitoring of under-triage in use, and the relevant
ethical and regulatory approvals would all be required.
