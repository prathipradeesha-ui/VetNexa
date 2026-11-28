# Development History

How VetNexa was built, stage by stage, with the Git commits that show each step. Every commit
is on the `main` branch of <https://github.com/prathipradeesha-ui/VetNexa>; open
`https://github.com/prathipradeesha-ui/VetNexa/commit/<hash>` to see exactly what changed.
Dates are the real commit times (Sri Lanka time). Each stage was tested before the next one
started (see the [project plan](project-plan.md) for the definition of done), and from Stage 18
every push was also checked by GitHub Actions.

## Stage by stage

| Stage                          | What was built                                                                                         | Commits (date)                                                                                |
| ------------------------------ | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| 1 Planning                     | Project plan and system architecture                                                                   | `d303af0` (19 Nov)                                                                            |
| 2 Brand                        | Logo set, colours and brand guidelines                                                                 | `8913b87` (19 Nov)                                                                            |
| 3 Monorepo                     | npm workspaces, TypeScript, ESLint, Prettier                                                           | `00dd3a3` (19 Nov)                                                                            |
| 4 Database                     | MySQL in Docker, Prisma data model, seed data                                                          | `3204d9d`, `eb04b68`, `de68e34` (19 Nov)                                                      |
| 5 API foundation               | Express app, health check, integration tests                                                           | `9a79fe2`, `413b2db` (19 Nov)                                                                 |
| 6 Accounts and roles           | Sign-up, login, roles, vet licence; tests; Zod security update                                         | `e47bd08`, `7567905`, `6286910`, `1f618a8`, `6c49243`, `ce311ff` (19 Nov)                     |
| 7 Front end                    | React app, design system, sign-in pages, Contact page                                                  | `cc19302`, `18c1b77`, `18fd5f0` (19 Nov)                                                      |
| 8 Pet profiles                 | Pet API with photo uploads, pet pages                                                                  | `3e4e6d3`, `fc6ae76`, `783f015`, `d6d6f2f` (19 Nov)                                           |
| 9 Health records               | Records, care reminders, timeline                                                                      | `49d19ac`, `e3e9fcc`, `c26431e`, `8475721`, `4736aa2`, `d83374f` (19 Nov)                     |
| 10 Clinic discovery            | Clinic directory, clinic pages, reviews                                                                | `f5ab4a7`, `d4570c1`, `60327ff`, `292f452` (20 Nov)                                           |
| 11 Veterinary portal           | Consultation booking, vet dashboard                                                                    | `0f98a31`, `f065132`, `49da163`, `b79de24` (20 Nov)                                           |
| 12 Rescue and adoption         | Rescue board, adoption listings and applications                                                       | `0fb0fa7`, `6bb2a74`, `a9bb5e5`, `ea891db`, `b889820` (20 Nov)                                |
| 13 AI wound model              | Python service, OpenCV checks, training, calibration, evaluation; verified image collection            | `6953abc`, `0872169`, `8a97b45`, `0058618`, `58f6e11` (20 Nov); `7fca36a`, `99aae77` (21 Nov) |
| 14 Wound check                 | AI service API, wound check API and pages                                                              | `497da59`, `8cf655d`, `6a9d618` (21 Nov)                                                      |
| 15 Pet-care assistant          | Knowledge base, safety checks, chat API and page                                                       | `07a3848`, `e6e04f3`, `f3e83e0` (21 Nov)                                                      |
| 16 Admin dashboard             | Statistics, users, clinics, reviews, messages                                                          | `605daa9`, `5a78875` (21 Nov)                                                                 |
| – Dogs and cats only           | Whole platform limited to dogs and cats                                                                | `4b6b8b2` (21 Nov)                                                                            |
| 17 Docker                      | Docker images and Compose for the whole platform                                                       | `bacfe2d` (21 Nov)                                                                            |
| 18 CI                          | GitHub Actions checks, Dependabot, poster checklist                                                    | `13a0183`, `70800e4` (21 Nov)                                                                 |
| 19 Symptoms and red flags      | Questionnaire, red flags, symptom rules, three-step wound check                                        | `a8dd43f`, `68a96ba`, `61ececc`, `182c5ec` (21 Nov)                                           |
| 20 Reliability-weighted triage | EfficientNet-B0, unfamiliar-photo check, weighted fusion, four outcomes, "Why this result"             | `d3e9c64`, `bd6819f`, `39ee4f1`, `4eac5d4`, `e19af6b` (21 Nov)                                |
| 22 Maps and emergency mode     | Google Maps, near-me, rescue location privacy, emergency help without an account, floating chat        | `65ec2ec`, `461a214`, `8a3d842`, `55408f3` (21 Nov)                                           |
| 21 Evaluation                  | Baselines, ablation, risk–coverage, OOD and calibration results                                        | `20a91fa`, `89caf6d` (21 Nov)                                                                 |
| 23 Photo storage               | MinIO bucket for photos, built from source                                                             | `e2e255c`, `7fa32c7`, `cc4004d`, `1b0d1dd` (21 Nov)                                           |
| 24 Installable app             | App icons and manifest, offline first-aid page, install button and offline notice                      | `56cf2d0`, `b2092a0`, `5630329` (21 Nov)                                                      |
| – Offline emergency help       | Emergency page offline: saved clinics, danger-sign check, first-aid guides, rescue reports later       | `86b793b`, `52f279e`, `ee333a1`, `212a908`, `445bdd3`, `8711636` (21 Nov)                     |
| – Friendly error page          | Clear message and automatic reload when a page fails to load                                           | `260422f` (21 Nov)                                                                            |
| 25 Security and accessibility  | Dependency and API review, fixes, access tests, contrast and screen reader fixes, axe in CI            | `9ec3b25`, `3af7d87`, `7e8d60a`, `cc5cb04`, `0dbcdb1`, `a7567a4` (21 Nov)                     |
| 26 Final documentation         | User guide with screenshots, setup guide, AI evaluation report; database port limited to this computer | `32e60c6`, `2aabb20`, `3daa944`, `16e378d` and the final README update (21 Nov)               |

After the 26 stages:

| Work                  | What was built                                                                                                                                              | Commits (date)                                                                                     |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Real photo collection | Community photo tier with clarity, duplicate, watermark and species checks; 841 clear dog and cat photos in 22 categories, each with its source and licence | `eb8c922`, `0bbee5d`, `e65c3cb`, `5159a39`, `9758cc6`, `4a20662`, `5e25fae`, `01c30bd` (22–27 Nov) |
| Skin check            | Advisory skin-condition model trained and evaluated on the real photos, saved with each check and shown on web and phone                                    | `6e8fd91`, `dbdd7a3`, `51cb601`, `af1d719`, `7d53204`, `3599970` (27–28 Nov)                       |
| Follow-up check-ins   | Plan a look again after a wound check, answer better, same or worse, reminders on the dashboard                                                             | `6c45a67`, `4c79637` (27 Nov)                                                                      |

Stage 22 (maps) was finished before Stage 21 (evaluation) because the maps and emergency mode
were requested during Stage 20; the table follows the real order of the commits.

## Poster ideas and where they were built

| Poster idea                                                                  | Built in                                                      |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Photo of the wound or skin                                                   | `6a9d618`, camera on phones in `61ececc` and `8a3d842`        |
| Symptoms and context (species, location, duration)                           | `a8dd43f`, `68a96ba`, `61ececc`                               |
| Quality checks: image quality                                                | `6953abc`, quality score in `bd6819f`                         |
| Quality checks: missing inputs and red flags                                 | `a8dd43f`                                                     |
| Quality checks: unfamiliar (OOD) photos                                      | `d3e9c64`, used in `bd6819f`                                  |
| EfficientNet-B0 with calibrated probabilities                                | `0872169` (calibration), `d3e9c64` (EfficientNet-B0)          |
| Rule-weighted symptom evidence                                               | `a8dd43f`                                                     |
| Reliability-weighted evidence fusion                                         | `bd6819f`                                                     |
| Uncertainty-aware triage: overrides, safe abstention, four outcomes          | `bd6819f`, `39ee4f1`, `4eac5d4`                               |
| Explanation and history                                                      | `4eac5d4`, history in `6a9d618`                               |
| Nearby clinics on a map or list                                              | `60327ff`, map in `461a214`                                   |
| Rescue map with location shared safely                                       | `a9bb5e5`, `ea891db`, map and privacy in `65ec2ec`, `461a214` |
| Evaluation: urgent sensitivity, macro-F1, ECE, risk–coverage, OOD, baselines | `8a97b45`, `20a91fa`, `89caf6d`                               |
| React, Node/Express, Python/FastAPI, PyTorch, OpenCV, MySQL/Prisma           | Stages 3–14                                                   |
| Installable web and mobile app                                               | `56cf2d0`, `b2092a0`, `5630329`                               |
| Safety-aware help without a connection (red flags always mean urgent)        | `52f279e`, `ee333a1`, `445bdd3`                               |
| MinIO storage and Docker                                                     | `bacfe2d`, `e2e255c`, `7fa32c7`                               |
| Ethics and verified data                                                     | `58f6e11`, `7fca36a`, `99aae77`                               |

## Not finished yet

| Item                                       | Why                                                                                                                                          | Plan                                         |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Training and evaluation on real wounds     | Only 19 real wound photos so far (the skin check uses the other real photos); results so far use a demonstration model and simulated answers | When PetWound or partner-clinic data arrives |
| Ethics approval for collecting real photos | Needed from the university before using clinic data                                                                                          | Before any real-world data collection        |
