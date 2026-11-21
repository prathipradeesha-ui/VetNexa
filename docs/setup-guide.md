# VetNexa Setup Guide

How to install, run, test and deploy VetNexa. There are two ways to run it:

- **Docker** (section 2): the whole platform with one command. Best for a demonstration or a
  server.
- **Local development** (section 3): each part runs on your computer with live reloading. Best
  for changing the code.

## 1. What you need

| Tool           | Version            | Needed for                                                      |
| -------------- | ------------------ | --------------------------------------------------------------- |
| Git            | any recent         | Getting the code                                                |
| Docker Desktop | 4.x with Compose 2 | Both ways (MySQL always runs in Docker)                         |
| Node.js        | 24 (20 or newer)   | Local development; CI uses Node 24                              |
| Python         | 3.11               | Local AI service and model training                             |
| Free ports     | see below          | 8080 (or `WEB_PORT`) for Docker; 5173, 4100, 8000, 3307 locally |

```bash
git clone https://github.com/prathipradeesha-ui/VetNexa.git
cd VetNexa
```

The project is a monorepo:

| Folder            | Part                                                         | Port |
| ----------------- | ------------------------------------------------------------ | ---- |
| `apps/web`        | Website (React, TypeScript, Vite)                            | 5173 |
| `apps/api`        | REST API (Node.js, Express, Prisma)                          | 4100 |
| `packages/shared` | Validation rules and types shared by the website and the API | –    |
| `services/ai`     | AI service: wound assessment and pet-care assistant (Python) | 8000 |
| `infra`           | Nginx, MySQL and MinIO configuration for Docker              | –    |

## 2. Running everything with Docker

### 2.1 First start

```bash
cp .env.example .env
```

Edit `.env`:

1. Set `JWT_SECRET` to a long random value:
   `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`
2. Change every `change-me-…` password.
3. If port 8080 is taken, set `WEB_PORT` (for example `8088`) and `PUBLIC_URL` to match
   (`http://localhost:8088`).
4. Recommended: set `AI_SERVICE_TOKEN` to another random value.

```bash
docker compose up -d --build                       # build and start all services
docker compose run --rm migrate npm run db:seed    # optional: demo data (development only)
```

The first build takes several minutes (MinIO is compiled from source and PyTorch is large).
Open `http://localhost:8080` (or your `WEB_PORT`).

| Container | Role                                                         | Reachable from your computer |
| --------- | ------------------------------------------------------------ | ---------------------------- |
| `web`     | Nginx: serves the website and forwards `/api` and `/uploads` | `WEB_PORT` (8080)            |
| `api`     | REST API                                                     | No (only through `web`)      |
| `migrate` | Applies database migrations, then stops                      | –                            |
| `ai`      | Wound assessment and assistant                               | No                           |
| `db`      | MySQL 8.4                                                    | `127.0.0.1:3307` for tools   |
| `minio`   | Photo storage (private bucket)                               | Console on `127.0.0.1:9001`  |

### 2.2 Demo accounts

After seeding, every demo account uses the password `VetNexa@2026`:

| Role                                 | Email                          |
| ------------------------------------ | ------------------------------ |
| Administrator                        | admin@vetnexa.lk               |
| Pet owner                            | nimali.perera@example.com      |
| Veterinarian (verified)              | dr.ruwan@example.com           |
| Veterinarian (verified)              | dr.anjali@example.com          |
| Veterinarian (awaiting verification) | dr.shalini@example.com         |
| Rescuer                              | rescue@helpingpaws.example.com |

Never seed a real installation: these passwords are public.

### 2.3 The AI model

The AI container loads `services/ai/models/wound-classifier.pt` (mounted read-only). Without it,
the site works but the wound check says it is unavailable. To create the demonstration model
see [section 4.2](#42-training-a-model); then restart the container with
`docker compose restart ai`.

### 2.4 Everyday commands

```bash
docker compose ps                          # status and health of each service
docker compose logs -f api                 # follow the API log
docker compose up -d --build web           # rebuild one service after a code change
docker compose down                        # stop (data is kept)
docker compose down -v                     # stop and DELETE the database and photos
docker compose exec api node dist/migrate-uploads.js   # move old local photos into MinIO
```

## 3. Local development

### 3.1 Database, API and website

```bash
npm install                                   # all JavaScript workspaces
docker compose up -d db                       # MySQL on port 3307
cp apps/api/.env.example apps/api/.env        # then set JWT_SECRET
npm run db:migrate -w @vetnexa/api            # create the tables
npm run db:seed -w @vetnexa/api               # demo data
npm run dev -w @vetnexa/api                   # terminal 1: http://localhost:4100
npm run dev -w @vetnexa/web                   # terminal 2: http://localhost:5173
```

Open <http://localhost:5173>. Vite forwards `/api` and `/uploads` to the API, so the browser
sees one address and the sign-in cookie works. The API health check is at
<http://localhost:4100/api/health>.

Photos are saved in `apps/api/uploads` (`STORAGE_DRIVER=local`). To try MinIO locally, run
`docker compose up -d minio` and set the `S3_…` lines in `apps/api/.env` with
`STORAGE_DRIVER=s3`.

### 3.2 AI service

```bash
cd services/ai
python -m venv .venv
.venv/Scripts/activate                 # Windows; macOS/Linux: source .venv/bin/activate
pip install -r requirements-dev.txt
python -m vetnexa_ai.service           # terminal 3: http://127.0.0.1:8000
```

The API finds it through `AI_SERVICE_URL` in `apps/api/.env`. If you set `VETNEXA_AI_TOKEN`
for the service, set the same value as `AI_SERVICE_TOKEN` for the API.

### 3.3 Google Maps (optional)

Without a key, maps use Google's keyless embed (one place at a time with a Directions link).
For the interactive map, create a **Maps JavaScript API** browser key in Google Cloud Console,
restrict it to your addresses (for example `http://localhost:5173/*`), and put it in
`apps/web/.env.local` as `VITE_GOOGLE_MAPS_API_KEY`, or in the root `.env` as
`GOOGLE_MAPS_API_KEY` for Docker, then rebuild the website.

## 4. AI model and evaluation

### 4.1 Data

Real dog and cat wound photos are not included in the repository. The folder layout, the
data policy (verified original data only) and how to re-create the current collection are in
[services/ai/datasets/README.md](../services/ai/datasets/README.md).

### 4.2 Training a model

```bash
cd services/ai
# Demonstration model from synthetic drawings (never for real use)
python -m vetnexa_ai.synthetic --out data/synthetic --per-class 60
python -m vetnexa_ai.train --data-dir data/synthetic --output-dir models --epochs 6 --demo

# Real data: images in data/wounds/<class>/
python -m vetnexa_ai.train --data-dir data/wounds --epochs 25
```

EfficientNet-B0 is the default; add `--arch resnet18` for the baseline. Training also fits the
calibration temperature and the out-of-distribution detector, and saves the train, validation
and test split in `models/split.json`.

### 4.3 Evaluation

```bash
python -m vetnexa_ai.evaluate --model models/wound-classifier.pt            # photo model
python -m vetnexa_ai.evaluate_triage --model models/wound-classifier.pt \
  --baseline-model models/baseline-resnet18/wound-classifier.pt --draws 3 --seed 7
```

Reports are written to `services/ai/reports/`. The results are explained in the
[AI evaluation report](ai-evaluation-report.md).

## 5. Tests and code quality

| Command (from the repository root)                        | What it checks                                                                                                                |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `npm test`                                                | Shared, API and website tests (the API uses a separate `vetnexa_test` database, created automatically; MySQL must be running) |
| `npm run lint`                                            | ESLint                                                                                                                        |
| `npm run typecheck`                                       | TypeScript in every workspace                                                                                                 |
| `npm run format:check`                                    | Prettier                                                                                                                      |
| `npm run build`                                           | Production builds of the API and the website                                                                                  |
| `npm audit`                                               | Known vulnerabilities in JavaScript packages                                                                                  |
| `cd services/ai && pytest`                                | AI service, including an end-to-end train → evaluate → assess                                                                 |
| `cd services/ai && ruff check . && ruff format --check .` | Python lint and formatting                                                                                                    |

GitHub Actions runs the same checks, plus Docker image builds, on every push to `main` and on
every pull request (see [.github/workflows/ci.yml](../.github/workflows/ci.yml)).

## 6. Configuration reference

### Root `.env` (Docker Compose)

| Variable                                                                              | Meaning                                              |
| ------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `PUBLIC_URL`, `WEB_PORT`                                                              | Address people open, and the port it is published on |
| `GOOGLE_MAPS_API_KEY`, `GOOGLE_MAPS_MAP_ID`                                           | Optional interactive maps                            |
| `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_ROOT_PASSWORD`, `MYSQL_PORT` | Database                                             |
| `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`, `S3_BUCKET`                                 | Photo storage                                        |
| `JWT_SECRET` (required), `SESSION_HOURS`, `LOG_LEVEL`                                 | API                                                  |
| `AI_SERVICE_TOKEN`                                                                    | Shared secret between the API and the AI service     |

### `apps/api/.env` (local API)

| Variable                                                               | Default                             | Meaning                                                  |
| ---------------------------------------------------------------------- | ----------------------------------- | -------------------------------------------------------- |
| `DATABASE_URL`                                                         | –                                   | `mysql://` connection string (required)                  |
| `JWT_SECRET`                                                           | –                                   | At least 32 characters (required)                        |
| `CORS_ORIGIN`                                                          | `http://localhost:5173`             | Exact website addresses, comma-separated; `*` is refused |
| `SESSION_HOURS`                                                        | `12`                                | How long a sign-in lasts                                 |
| `STORAGE_DRIVER`                                                       | `local`                             | `local` folder or `s3` (MinIO)                           |
| `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | –                                   | Required when `STORAGE_DRIVER=s3`                        |
| `AI_SERVICE_URL`, `AI_SERVICE_TOKEN`, `AI_TIMEOUT_MS`                  | `http://127.0.0.1:8000`, –, `30000` | AI service                                               |
| `PORT`, `LOG_LEVEL`                                                    | `4100`, `info`                      | Server                                                   |

The API checks these at start-up and refuses to start with a clear message if one is missing
or invalid.

### AI service

| Variable                             | Default                      | Meaning                             |
| ------------------------------------ | ---------------------------- | ----------------------------------- |
| `VETNEXA_AI_MODEL`                   | `models/wound-classifier.pt` | Checkpoint to load                  |
| `VETNEXA_AI_TOKEN`                   | –                            | Required `X-Service-Token` when set |
| `VETNEXA_AI_HOST`, `VETNEXA_AI_PORT` | `127.0.0.1`, `8000`          | Where to listen                     |

## 7. Going live

Before real users, follow the advice in the
[security review](security-accessibility-review.md#14-remaining-risks-and-advice-for-deployment):

1. Serve VetNexa over **HTTPS** (for example a reverse proxy with Let's Encrypt) and add a
   `Strict-Transport-Security` header. Installing the app on phones also needs HTTPS.
2. Use new random values for every secret in `.env`, set `AI_SERVICE_TOKEN`, and never run the
   seed.
3. Set `PUBLIC_URL` to the real address.
4. Back up the `db-data` and `minio-data` volumes.
5. Replace the demonstration model with one trained and evaluated on real, veterinarian-labelled
   cases, and have a veterinarian review the symptom rules and the knowledge base.

## 8. Troubleshooting

| Problem                                                        | Solution                                                                                                                                                                   |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `port is already allocated` for 8080                           | Another program uses the port; set `WEB_PORT` and `PUBLIC_URL` in `.env`                                                                                                   |
| The website shows "This page could not load"                   | In development the Vite server has stopped; start it again with `npm run dev -w @vetnexa/web`                                                                              |
| Wound check says it is unavailable                             | No model loaded: train one (section 4.2) and restart the AI service; check `GET /health` on port 8000                                                                      |
| Windows: Prisma `EPERM` when renaming `schema-engine`          | Antivirus is holding the file. Delete the `.tmp` files in `node_modules/@prisma/engines` and set `PRISMA_SCHEMA_ENGINE_BINARY` to the existing `schema-engine-windows.exe` |
| `npm ci` fails with `EPERM` or `EBUSY`                         | Stop running dev servers (they keep files open) and run it again                                                                                                           |
| An old version keeps appearing after an update (Docker build)  | The service worker updates on the next visit; reload once, or clear site data in the browser                                                                               |
| API stops at start-up with `Invalid environment configuration` | The message lists each missing or wrong variable; fix them in `.env`                                                                                                       |
| API tests fail to connect                                      | Start MySQL with `docker compose up -d db`                                                                                                                                 |
| Maps show only one place                                       | No Google Maps key: this is the keyless mode (section 3.3)                                                                                                                 |
