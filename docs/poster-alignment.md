# Alignment with the Project Poster

The submitted poster, _A Safety-Aware Multimodal Deep Learning Framework for Veterinary Wound
Assessment Using Reliability-Weighted Evidence Fusion and Uncertainty-Aware Triage_, defines
what VetNexa must deliver. This document maps every poster idea to the system and lists the
work that closes the remaining gaps (stages 19–24 in [project-plan.md](project-plan.md)).

Status: **Done** = implemented and tested · **Partial** = some of it exists · **Planned** = not
built yet.

## AI framework (poster sections 4, 6 and 10)

| Poster idea                                              | Status  | In VetNexa now                                        | Work to do                                                                                                      | Stage |
| -------------------------------------------------------- | ------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ----- |
| Image or photo input (wound / skin)                      | Done    | Wound check upload for dogs and cats                  | Add camera capture on phones                                                                                    | 24    |
| Symptoms and context input (species, location, duration) | Done    | Species comes from the pet profile only               | Short symptom questionnaire: body location, duration, symptoms, behaviour                                       | 19    |
| Input quality checks: image quality                      | Done    | OpenCV blur, exposure, size checks with retake advice | Turn the checks into a 0–1 image reliability score used by fusion                                               | 20    |
| Input quality checks: missing inputs                     | Done    | –                                                     | Detect unanswered questions; lower questionnaire reliability                                                    | 19    |
| Input quality checks: red flags                          | Done    | Emergency detection exists in the chat assistant      | Red-flag answers (heavy bleeding, collapse, breathing…) force urgent attention                                  | 19    |
| Input quality checks: OOD detection                      | Planned | –                                                     | Energy score plus feature-distance (Mahalanobis) check; unfamiliar photos are not assessed                      | 20    |
| Image model: EfficientNet-B0, calibrated probabilities   | Partial | ResNet-18 with temperature scaling                    | EfficientNet-B0 backbone; keep ResNet-18 as a comparison baseline                                               | 20    |
| Symptom and context evidence (rule-weighted)             | Done    | –                                                     | Rule-weighted risk score from the questionnaire, each rule documented                                           | 19    |
| Reliability-weighted evidence fusion, combined risk      | Planned | Image probabilities only                              | Weight image and symptom evidence by their reliability; explain each contribution                               | 20    |
| Uncertainty-aware triage: calibrated confidence          | Done    | Temperature scaling (T ≥ 1)                           | –                                                                                                               | –     |
| Uncertainty-aware triage: safety overrides               | Partial | Severity escalation and always-refer classes          | Red-flag and species overrides on the fused result                                                              | 20    |
| Uncertainty-aware triage: safe abstention                | Done    | "Uncertain" below 60 % confidence                     | Abstain also on OOD, poor quality or conflicting evidence                                                       | 20    |
| Four triage outcomes                                     | Partial | Minor / Moderate / Severe / Uncertain + refer flag    | Routine / monitor · Veterinary consultation recommended · Urgent veterinary attention · Unable to assess safely | 20    |
| Explanation and history (follow-up)                      | Partial | Result page and history list                          | "Why this result" panel showing each piece of evidence and its weight; follow-up check-ins                      | 20    |
| Evaluation: urgent-case sensitivity                      | Partial | Under-triage rate                                     | Report sensitivity for urgent cases as the primary metric                                                       | 21    |
| Evaluation: macro-F1, per-class recall                   | Done    | `evaluate.py`                                         | –                                                                                                               | –     |
| Evaluation: calibration and ECE                          | Done    | ECE before and after scaling                          | Reliability diagram                                                                                             | 21    |
| Evaluation: selective risk and coverage                  | Partial | Coverage and accuracy when answered                   | Full risk–coverage curve and AURC                                                                               | 21    |
| Evaluation: OOD detection                                | Planned | –                                                     | AUROC / FPR at 95 % TPR on held-out non-dog/cat and non-wound images                                            | 21    |
| Baselines and ablations                                  | Planned | –                                                     | Image-only vs unweighted fusion vs reliability-weighted fusion; ResNet-18 vs EfficientNet-B0                    | 21    |

## Application (poster sections 6 and 9)

| Poster idea                                | Status  | In VetNexa now                            | Work to do                                                                                   | Stage |
| ------------------------------------------ | ------- | ----------------------------------------- | -------------------------------------------------------------------------------------------- | ----- |
| Assess wound: photo + symptom questions    | Partial | Photo upload                              | Questionnaire step before the photo                                                          | 19    |
| Triage result with confidence, explanation | Partial | Severity, confidence, guidance            | Four outcomes and evidence explanation                                                       | 20    |
| Nearby clinics on a map or list            | Partial | Searchable list with "open in maps" links | Interactive map (Leaflet + OpenStreetMap) and "near me" sorting                              | 22    |
| Rescue map, location shared safely         | Partial | Rescue reports with text location         | Map of reports; exact location only for the assigned rescuer, others see an approximate area | 22    |
| Web and mobile application                 | Partial | Responsive website                        | Installable progressive web app (PWA) with camera capture                                    | 24    |
| Pet owners, rescuers, veterinary services  | Done    | Owner, rescuer, vet and admin roles       | –                                                                                            | –     |

## Technology stack (poster section 8)

| Poster item                 | Status  | Notes                                 | Stage |
| --------------------------- | ------- | ------------------------------------- | ----- |
| React + TypeScript          | Done    | `apps/web`                            | –     |
| Node.js + Express           | Done    | `apps/api`                            | –     |
| Python + FastAPI            | Done    | `services/ai`                         | –     |
| PyTorch                     | Done    | Training, calibration, inference      | –     |
| torchvision EfficientNet-B0 | Planned | ResNet-18 today                       | 20    |
| OpenCV                      | Done    | Image quality checks                  | –     |
| MySQL + Prisma              | Done    | –                                     | –     |
| MinIO storage               | Planned | Uploads are stored in a Docker volume | 23    |
| Docker                      | Done    | Full Compose stack                    | –     |

## Dataset and ethics (poster section 5)

Done: only verified original data is used (see `services/ai/datasets/README.md`), with
provenance, licences and SHA-256 fingerprints recorded; photos are stored without location
metadata. Still open: real labelled wound data (PetWound request, partner clinic) and approval
for any real-world data collection. Training and evaluating the multimodal model on real
cases depends on this data; until then the pipeline is tested on synthetic data and every
result from a demonstration model is labelled as such.
