<p align="center"><img src="brand/logo-stacked.svg" alt="VetNexa" width="220"></p>

# VetNexa

**AI-assisted pet healthcare and animal welfare platform.**

VetNexa connects pet owners, veterinarians, veterinary clinics, animal rescuers and adopters in one place. Owners keep their pets' health records organised, find nearby clinics, book consultations and get an early, AI-supported indication of whether a wound needs veterinary attention. Rescuers and adopters use the same platform to give animals in need a new home.

> **AI safety notice:** VetNexa's wound assessment is a decision-support prototype. It does not diagnose and is not a substitute for examination by a qualified veterinarian.

## Main modules

- Pet owner accounts and pet profiles
- Health records (vaccinations, treatments, medical history)
- AI wound assessment for dogs and cats
- Veterinary portal and consultations
- Clinic discovery with reviews and ratings
- Rescue reporting and adoption
- AI pet-care chatbot
- Admin dashboard

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

## Getting started

Requirements: Node.js 20+, Docker Desktop.

```bash
npm install                                  # install all workspaces
docker compose up -d db                      # start MySQL on port 3307
cp apps/api/.env.example apps/api/.env       # local configuration
npm run db:migrate -w @vetnexa/api           # create the tables
npm run db:seed -w @vetnexa/api              # load demo data
npm run dev -w @vetnexa/api                  # start the API on http://localhost:4100
```

Check the API is running: http://localhost:4100/api/health

### Local ports

| Service        | Port |
| -------------- | ---- |
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
| Veterinarian (verified)              | dr.anjali@example.com          |
| Veterinarian (awaiting verification) | dr.shalini@example.com         |
| Rescuer                              | rescue@helpingpaws.example.com |

## Documentation

- [Architecture](docs/architecture.md)
- [API reference](docs/api.md)
- [Project plan](docs/project-plan.md)
- [Brand guidelines](docs/brand-guidelines.md)

## Project owner

**Pradeesha Baskaran** – developer
Contact: 0785503592
