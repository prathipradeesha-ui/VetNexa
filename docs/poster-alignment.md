# Alignment with the Project Poster

The submitted poster, _A Safety-Aware Multimodal Deep Learning Framework for Veterinary Wound
Assessment Using Reliability-Weighted Evidence Fusion and Uncertainty-Aware Triage_, defines
what VetNexa must deliver. This document maps every poster idea to the system and lists the
work that closes the remaining gaps (stages 19–24 in [project-plan.md](project-plan.md)).

Status: **Done** = implemented and tested · **Partial** = some of it exists · **Planned** = not
built yet.

## AI framework (poster sections 4, 6 and 10)

| Poster idea                                              | Status | In VetNexa now                                                                                                  | Work to do                   | Stage |
| -------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------- | ---------------------------- | ----- |
| Image or photo input (wound / skin)                      | Done   | Wound check upload for dogs and cats                                                                            | Add camera capture on phones | 24    |
| Symptoms and context input (species, location, duration) | Done   | Questionnaire: body location, duration, cause, signs, appetite, energy, pain; species from the pet profile      | –                            | 19    |
| Input quality checks: image quality                      | Done   | OpenCV checks; continuous quality score used as part of the photo's reliability                                 | –                            | 20    |
| Input quality checks: missing inputs                     | Done   | Unanswered questions listed; completeness is the reliability of the answers                                     | –                            | 20    |
| Input quality checks: red flags                          | Done   | Eight red flags; any one forces urgent attention, even with a poor photo                                        | –                            | 19    |
| Input quality checks: OOD detection                      | Done   | Energy + Mahalanobis detector; unfamiliar photos are not used                                                   | –                            | 20    |
| Image model: EfficientNet-B0, calibrated probabilities   | Done   | EfficientNet-B0 (default) with temperature scaling; ResNet-18 kept as baseline                                  | –                            | 20    |
| Symptom and context evidence (rule-weighted)             | Done   | 23 documented rules combined as a noisy-OR into a risk and level                                                | –                            | 19    |
| Reliability-weighted evidence fusion, combined risk      | Done   | risk = Σ reliability × risk / Σ reliability, explained per input                                                | –                            | 20    |
| Uncertainty-aware triage: calibrated confidence          | Done   | Temperature scaling (T ≥ 1)                                                                                     | –                            | –     |
| Uncertainty-aware triage: safety overrides               | Done   | Red flags, reliable-input floors, always-refer wound types                                                      | –                            | 20    |
| Uncertainty-aware triage: safe abstention                | Done   | Unable to assess safely when overall reliability < 0.35                                                         | –                            | 20    |
| Four triage outcomes                                     | Done   | Routine / monitor · Veterinary consultation recommended · Urgent veterinary attention · Unable to assess safely | –                            | 20    |
| Explanation and history (follow-up)                      | Done   | 'Why this result' with each input's risk, reliability and weight; history list                                  | Follow-up check-ins          | –     |
| Evaluation: urgent-case sensitivity                      | Done   | Primary metric; 80.0 % (proposed) vs 68.3 % unweighted and 41.7 % image only, on synthetic data                 | Repeat on real cases         | 21    |
| Evaluation: macro-F1, per-class recall                   | Done   | `evaluate.py`                                                                                                   | –                            | –     |
| Evaluation: calibration and ECE                          | Done   | ECE and a reliability diagram for each backbone                                                                 | –                            | 21    |
| Evaluation: selective risk and coverage                  | Done   | Risk–coverage curves and AURC for each method                                                                   | –                            | 21    |
| Evaluation: OOD detection                                | Done   | AUROC 0.939, FPR at 95 % TPR 48 % (synthetic)                                                                   | Real non-wound images        | 21    |
| Baselines and ablations                                  | Done   | Image only, unweighted and reliability-weighted; EfficientNet-B0 vs ResNet-18                                   | Repeat on real cases         | 21    |

## Application (poster sections 6 and 9)

| Poster idea                                | Status  | In VetNexa now                                                                                                  | Work to do      | Stage |
| ------------------------------------------ | ------- | --------------------------------------------------------------------------------------------------------------- | --------------- | ----- |
| Assess wound: photo + symptom questions    | Done    | Three steps: pet and red flags, symptom questions, photo                                                        | –               | 19    |
| Triage result with confidence, explanation | Done    | Four outcomes with reliability and per-input explanation                                                        | –               | 20    |
| Nearby clinics on a map or list            | Done    | Google map (interactive with an API key, keyless embed otherwise), near-me sorting, call and directions buttons | –               | 22    |
| Rescue map, location shared safely         | Done    | Rescue map; exact spot only for reporter, assigned rescuer and admins, about 1 km area for others               | –               | 22    |
| Web and mobile application                 | Partial | Responsive site; camera opens directly on phones; emergency mode works without an account                       | Installable PWA | 24    |
| Pet owners, rescuers, veterinary services  | Done    | Owner, rescuer, vet and admin roles                                                                             | –               | –     |

## Technology stack (poster section 8)

| Poster item                 | Status | Notes                                                                            | Stage |
| --------------------------- | ------ | -------------------------------------------------------------------------------- | ----- |
| React + TypeScript          | Done   | `apps/web`                                                                       | –     |
| Node.js + Express           | Done   | `apps/api`                                                                       | –     |
| Python + FastAPI            | Done   | `services/ai`                                                                    | –     |
| PyTorch                     | Done   | Training, calibration, inference                                                 | –     |
| torchvision EfficientNet-B0 | Done   | Default backbone; ResNet-18 kept for comparison                                  | 20    |
| OpenCV                      | Done   | Image quality checks                                                             | –     |
| MySQL + Prisma              | Done   | –                                                                                | –     |
| MinIO storage               | Done   | Private MinIO bucket for photos, built from source; local folder for development | 23    |
| Docker                      | Done   | Full Compose stack                                                               | –     |

## Additions beyond the poster

| Addition                               | Why                                                                                                                                       |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Emergency mode without an account      | In an emergency nobody should have to register first: nearest clinics, camera wound check (not stored) and rescue reports work signed out |
| Floating pet-care assistant            | Quick questions from any page; emergencies in the chat are redirected to clinics                                                          |
| Call and directions buttons on clinics | One tap to phone a clinic or open Google Maps directions                                                                                  |
| Dogs and cats only                     | The whole platform is scoped to the species the AI and knowledge base cover                                                               |

## Dataset and ethics (poster section 5)

Done: only verified original data is used (see `services/ai/datasets/README.md`), with
provenance, licences and SHA-256 fingerprints recorded; photos are stored without location
metadata. Still open: real labelled wound data (PetWound request, partner clinic) and approval
for any real-world data collection. Training and evaluating the multimodal model on real
cases depends on this data; until then the pipeline is tested on synthetic data and every
result from a demonstration model is labelled as such.
