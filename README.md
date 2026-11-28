<p align="center"><img src="brand/logo-stacked.svg" alt="VetNexa" width="220"></p>

# VetNexa

[![CI](https://github.com/prathipradeesha-ui/VetNexa/actions/workflows/ci.yml/badge.svg)](https://github.com/prathipradeesha-ui/VetNexa/actions/workflows/ci.yml)

**AI-assisted healthcare and welfare platform for dogs and cats.**

VetNexa is built for **dogs and cats only**. It connects their owners, veterinarians, veterinary clinics, animal rescuers and adopters in one place. Owners keep their pets' health records organised, find nearby clinics, book consultations and get an early, AI-supported indication of whether a wound needs veterinary attention. Rescuers and adopters use the same platform to give animals in need a new home.

> **AI safety notice:** VetNexa's wound assessment is a decision-support prototype. It does not diagnose and is not a substitute for examination by a qualified veterinarian.

## Main modules

- Pet owner accounts and pet profiles
- Health records (vaccinations, treatments, medical history)
- AI wound assessment for dogs and cats: photo plus symptom questionnaire and red flags
- **Emergency mode without an account**: nearest emergency clinics, camera wound check (not
  stored) and rescue reports
- Veterinary portal and consultations
- Clinic discovery with Google Maps, "near me" sorting, directions and call buttons, reviews
- Rescue reporting with a privacy-safe map, and adoption
- AI pet-care assistant, on its own page and as a floating chat in the corner of every page
- Admin dashboard
- **Installable app**: add VetNexa to a phone's home screen; emergency help keeps working
  without a connection

## Technology

| Area      | Technology                             |
| --------- | -------------------------------------- |
| Front end | React, TypeScript, Vite                |
| Back end  | Node.js, Express, TypeScript           |
| Database  | MySQL with Prisma ORM                  |
| AI        | Python, PyTorch, OpenCV                |
| Testing   | Vitest, Supertest, pytest              |
| Quality   | ESLint, Prettier                       |
| DevOps    | Docker, Docker Compose, GitHub Actions |

## Running with Docker (whole platform)

Requirements: Docker Desktop.

```bash
cp .env.example .env                                  # then set JWT_SECRET and the passwords
docker compose up -d --build                          # build and start all six services
docker compose run --rm migrate npm run db:seed       # optional: demo data (development only)
```

Open http://localhost:8080 (change `WEB_PORT` in `.env` if the port is taken). The API and AI
service are not published on the host; Nginx in the `web` container forwards `/api` and
`/uploads` to the API. To enable wound assessment, place a trained checkpoint at
`services/ai/models/wound-classifier.pt`; it is mounted read-only into the AI container.

| Container | Image                        | Role                                                 |
| --------- | ---------------------------- | ---------------------------------------------------- |
| `web`     | Nginx 1.28 + Vite build      | Website, security headers, proxy to the API          |
| `api`     | Node.js 24 (bundled Express) | REST API, runs as a non-root user, uploads in volume |
| `migrate` | API build stage              | Applies Prisma migrations once, then exits           |
| `ai`      | Python 3.11 + CPU PyTorch    | Wound assessment and pet-care assistant (internal)   |
| `db`      | MySQL 8.4                    | Database, data in the `db-data` volume               |
| `minio`   | MinIO (built from source)    | Object storage for uploaded photos (private bucket)  |

## Photo storage (MinIO)

In Docker, uploaded photos are stored in **MinIO**, an S3-compatible object store, as proposed
in the project. The API creates a private bucket on start-up and streams photos to the browser,
so the bucket is never exposed and photo links (`/uploads/…`) look the same as before. For local
development the API keeps using the `apps/api/uploads` folder (`STORAGE_DRIVER=local`).

- MinIO stopped publishing community container images, so `infra/minio/Dockerfile` builds a
  pinned release (`RELEASE.2025-10-15T17-29-55Z`) from MinIO's official source code. The first
  build takes a few minutes.
- Move photos saved before MinIO into the bucket (safe to repeat, `--dry-run` to preview):
  `docker compose exec api node dist/migrate-uploads.js`.
- The MinIO console is available on <http://localhost:9001> (loopback only) with
  `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` from `.env`.

## Google Maps

Maps work without any setup using Google's keyless embed, which shows one place at a time,
with "Directions" links that open Google Maps. For the full interactive map (all clinics or
reports as pins, info windows and your location), create a browser API key:

1. In [Google Cloud Console](https://console.cloud.google.com/), create a project and enable
   **Maps JavaScript API** (billing must be enabled; Google gives a free monthly allowance).
2. Under **APIs & Services → Credentials**, create an **API key** and restrict it to
   **HTTP referrers** (for example `http://localhost:5173/*` and your domain) and to the Maps
   JavaScript API.
3. Put it in `apps/web/.env.local` as `VITE_GOOGLE_MAPS_API_KEY=…` for development, or in the
   root `.env` as `GOOGLE_MAPS_API_KEY=…` for Docker, and rebuild the web app.

The user's own location is only requested when they press "Near me" or "Use my current
location", and it is never sent to the server except as part of a rescue report.

## Installing the app on a phone

VetNexa is a progressive web app, so it can be installed without an app store:

- **Android (Chrome or Edge):** tap **Install app** on the card at the bottom of the page, or
  open the browser menu and choose **Install app**.
- **iPhone and iPad (Safari):** tap **Share**, then **Add to Home Screen**.
- **Windows and macOS (Chrome or Edge):** use the install icon in the address bar.

Pressing and holding the app icon gives shortcuts to Emergency help, Find a clinic and a new
wound check. Installing needs HTTPS (or `localhost`), and the service worker is only used in
production builds, so `npm run dev` always loads fresh files.

### Emergency help with or without internet

Once VetNexa has been opened, the emergency page works online and offline:

| Feature                       | Online                          | Offline                                                                 |
| ----------------------------- | ------------------------------- | ----------------------------------------------------------------------- |
| Emergency clinics             | Live list, map, near-me sorting | List saved on the phone (with its date); call and near-me still work    |
| Wound check                   | Photo and symptom check         | Danger-sign check on the phone: any sign means "go to a vet now"        |
| First-aid guides              | Yes                             | Yes (built from the assistant's emergency articles)                     |
| Report an animal in need      | Sent straight away              | Kept on the phone and sent automatically when the connection comes back |
| Other pages (records, adopt…) | Yes                             | Offline page with wound first aid and a link to emergency help          |

The photo check stays online only: the model runs on the server and is not used without it.
Nothing private is saved for offline use. Health records, wound photos and account details
always come from the server; the only things kept on the phone are the public clinic list and,
until it is sent, a rescue report the person wrote themselves.

## Development setup

Requirements: Node.js 24 (20 or newer), Docker Desktop, and Python 3.11 for the AI service.
The [setup guide](docs/setup-guide.md) covers every step, all settings and common problems.

```bash
npm install                                  # install all workspaces
docker compose up -d db                      # start MySQL on port 3307
cp apps/api/.env.example apps/api/.env       # local configuration
npm run db:migrate -w @vetnexa/api           # create the tables
npm run db:seed -w @vetnexa/api              # load demo data
npm run dev -w @vetnexa/api                  # terminal 1: API on http://localhost:4100
npm run dev -w @vetnexa/web                  # terminal 2: website on http://localhost:5173
```

Open http://localhost:5173 for the website. The API health check is at http://localhost:4100/api/health.

### Local ports

| Service        | Port |
| -------------- | ---- |
| Website (Vite) | 5173 |
| API            | 4100 |
| MySQL (Docker) | 3307 |

API tests use a separate `vetnexa_test` database, which is created and migrated automatically when you run `npm test`.

Useful commands: `npm run lint`, `npm run typecheck`, `npm test`, `npm run db:studio -w @vetnexa/api` (browse the database).

### Demo accounts

All demo accounts use the password `VetNexa@2026` (defined in `apps/api/prisma/seed.ts`). Development use only.

| Role                                 | Email                          |
| ------------------------------------ | ------------------------------ |
| Administrator                        | admin@vetnexa.lk               |
| Pet owner                            | nimali.perera@example.com      |
| Veterinarian (verified)              | dr.ruwan@example.com           |
| Veterinarian (verified)              | dr.anjali@example.com          |
| Veterinarian (awaiting verification) | dr.shalini@example.com         |
| Rescuer                              | rescue@helpingpaws.example.com |

## Continuous integration

GitHub Actions ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs on every push to
`main` and every pull request:

| Job                         | Checks                                                                                           |
| --------------------------- | ------------------------------------------------------------------------------------------------ |
| Web, API and shared package | Prettier, ESLint, type-check, all Vitest suites (API tests against MySQL 8.4), production builds |
| AI service                  | ruff lint and format, pytest (CPU-only PyTorch)                                                  |
| Docker images               | Compose file validation, API, web, MinIO and AI image builds with layer caching                  |

Dependabot ([`.github/dependabot.yml`](.github/dependabot.yml)) proposes weekly updates for npm,
pip, GitHub Actions and Docker base images; each update must pass CI before it is merged.

## Project status

All 26 planned stages are complete (see the [project plan](docs/project-plan.md) and the
[development history](docs/development-history.md)), and every idea from the project poster is
built and tested ([poster alignment](docs/poster-alignment.md)). Owners can also plan follow-up
check-ins after a wound check, on the web and in the installed mobile app. The wound results so
far come from a demonstration model and simulated answers. The advisory skin check is trained
on 767 of the 841 collected real dog and cat photos (macro-F1 0.62 on held-out photos). The
[AI evaluation report](docs/ai-evaluation-report.md) explains what these results show and what
they do not. Still to do before real use:

- train and evaluate on real, veterinarian-labelled dog and cat wound photos (PetWound and a
  partner clinic have been asked), after ethics approval;
- veterinary review of the symptom rules, the knowledge base and the triage thresholds;
- the deployment steps in the [security review](docs/security-accessibility-review.md)
  (HTTPS, secrets, ending sessions on sign-out).

## Documentation

**Guides**

- [User guide](docs/user-guide.md) – how to use VetNexa, with screenshots
- [Setup guide](docs/setup-guide.md) – install, run, test and deploy
- [AI evaluation report](docs/ai-evaluation-report.md) – final results of the wound assessment

**Reference**

- [Architecture](docs/architecture.md)
- [API reference](docs/api.md)
- [Project plan](docs/project-plan.md)
- [Development history (commits for each stage)](docs/development-history.md)
- [Brand guidelines](docs/brand-guidelines.md)
- [AI wound assessment – model card](docs/ai-model.md)
- [AI service setup](services/ai/README.md)
- [Pet-care assistant](docs/assistant.md)
- [Triage evaluation](docs/evaluation.md)
- [Alignment with the project poster](docs/poster-alignment.md)
- [Security and accessibility review](docs/security-accessibility-review.md)

## Project owner

**Pradeesha Baskaran** – developer
Contact: 0785503592
