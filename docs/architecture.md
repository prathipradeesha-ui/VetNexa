# VetNexa – System Architecture

This document describes how VetNexa is structured, how its services communicate, and the main design decisions behind it.

## 1. High-level view

VetNexa is split into three independently deployable services plus a shared package, kept together in one Git repository (a _monorepo_).

```
                    ┌──────────────────────────┐
  Browser / Mobile  │  apps/web                │  React + TypeScript (Vite)
  ─────────────────►│  Single-page application │  Responsive UI for all roles
                    └────────────┬─────────────┘
                                 │ REST (JSON, JWT in HttpOnly cookie)
                    ┌────────────▼─────────────┐
                    │  apps/api                │  Node.js + Express + TypeScript
                    │  Auth, RBAC, business    │  Prisma ORM
                    │  logic, file uploads     │
                    └──────┬────────────┬──────┘
                           │            │ REST (multipart image → JSON result)
               ┌───────────▼───┐   ┌────▼──────────────────┐
               │  MySQL 8      │   │  services/ai          │  Python, FastAPI,
               │  (Prisma)     │   │  Wound assessment +   │  OpenCV, PyTorch
               └───────────────┘   │  chatbot knowledge    │
                                   └───────────────────────┘
```

- The **web app** never talks to the database or AI service directly. Every request goes through the API, which enforces authentication and role-based access control (RBAC).
- The **AI service** is internal only. It is not exposed publicly in Docker Compose; only the API can reach it.
- **packages/shared** holds TypeScript types and validation schemas (Zod) used by both the web app and the API, so form validation and API validation stay identical.

## 2. Repository layout

```
VetNexa/
├── apps/
│   ├── web/             React front end
│   └── api/             Express REST API + Prisma schema
├── packages/
│   └── shared/          Shared types, enums and Zod schemas
├── services/
│   └── ai/              Python AI service (training scripts + inference API)
├── brand/               Logo files and brand assets
├── docs/                Planning, architecture and evaluation documents
├── docker-compose.yml   Runs MySQL, API, AI service and web together
└── .github/workflows/   Continuous integration
```

## 3. User roles

| Role | Main capabilities |
| --- | --- |
| `OWNER` | Manage own profile and pets, health records, wound assessments, book consultations, adopt, review clinics. |
| `VET` | View pets of owners who granted access / booked consultations, manage consultations, write treatment records and vaccinations. Account must be verified by an admin. |
| `RESCUER` | Report animals needing rescue, create adoption listings, manage adoption applications. |
| `ADMIN` | Manage users, verify vets, manage clinics, moderate reviews and listings, view platform statistics. |

A user has exactly one role. Adopters are regular `OWNER` accounts, which keeps the model simple.

## 4. Backend design (apps/api)

Layered structure, one folder per module:

```
src/
├── modules/
│   ├── auth/        routes → controller → service → Prisma
│   ├── pets/
│   ├── records/
│   ├── assessments/
│   ├── consultations/
│   ├── clinics/
│   ├── adoption/
│   ├── reviews/
│   ├── chat/
│   └── admin/
├── middleware/      authenticate, authorize(roles), validate(schema), errorHandler
├── lib/             prisma client, logger, AI service client
└── app.ts           Express app factory (used by server.ts and tests)
```

- **Routes** declare the URL, the allowed roles and the validation schema.
- **Controllers** translate HTTP into service calls.
- **Services** contain business rules and are the only layer that uses Prisma.
- Exporting an `createApp()` factory lets Supertest exercise the real app without opening a port.

### Security measures

- Passwords hashed with **bcrypt** (cost 12).
- Short-lived **JWT** access tokens stored in an `HttpOnly`, `SameSite=Lax` cookie (not reachable from JavaScript, which limits XSS token theft).
- **RBAC** middleware on every protected route, plus ownership checks in services (an owner can only read their own pets).
- **Helmet** security headers, **CORS** restricted to the web origin, **rate limiting** on auth and AI endpoints.
- All input validated with **Zod** before reaching business logic.
- Uploaded images limited by size and MIME type, stored with random file names.
- Errors returned in one consistent shape without stack traces in production.

## 5. Data model (summary)

Full schema lives in `apps/api/prisma/schema.prisma`. Main entities:

- **User** (role, name, email, password hash, phone, verified flag)
- **VetProfile** (licence number, specialisation, clinic) – one-to-one with a VET user
- **Pet** (owner, species, breed, sex, date of birth, weight, photo, microchip)
- **HealthRecord** (pet, type: VACCINATION / TREATMENT / CHECKUP / MEDICATION / ALLERGY, dates, notes, created by)
- **WoundAssessment** (pet, image, predicted class, confidence, severity, guidance, model version)
- **Clinic** (name, address, city, coordinates, services, opening hours, contact, emergency flag)
- **Consultation** (pet, owner, vet, clinic, scheduled time, status, reason, vet notes)
- **AdoptionListing** (rescuer, animal details, photos, status) and **AdoptionApplication**
- **RescueReport** (reporter, location, description, urgency, status)
- **Review** (author, clinic, rating 1–5, comment, moderation status)
- **ChatMessage** (user, role, content) for chatbot history

## 6. AI service (services/ai)

Two responsibilities:

1. **Wound assessment** – a PyTorch image classifier (transfer learning on a pretrained CNN such as ResNet-18 / EfficientNet-B0). OpenCV handles image loading, resizing, colour normalisation and basic quality checks (blur and brightness) before inference.
2. **Pet-care chatbot** – a retrieval-based assistant over a curated pet-care knowledge base. It returns general educational guidance only and always redirects emergencies to a veterinarian.

### AI safety principles

- The wound assessment is a **decision-support prototype**, not a diagnosis.
- Every result includes the model's **confidence**, a plain-language explanation of uncertainty and a **disclaimer**.
- Low-confidence or poor-quality images return "Unable to assess reliably" instead of a guess.
- Any result suggesting moderate or severe injury recommends contacting a veterinarian, with a link to Clinic Discovery.
- Model performance (accuracy, precision, recall, F1, confusion matrix) is documented in `docs/ai-evaluation.md`, including known limitations and dataset bias.

## 7. Front end (apps/web)

- **React + TypeScript + Vite**, **React Router** for routing, **TanStack Query** for server state, **React Hook Form + Zod** for forms.
- Hand-written CSS using design tokens (CSS custom properties) from the brand guidelines, so colours and spacing stay consistent.
- Role-aware layout: public pages (home, clinics, adoption, about, contact) and a dashboard area with a sidebar whose items depend on the user's role.
- Mobile first: the sidebar collapses into a drawer below 900 px; tables become stacked cards on small screens.
- Accessibility: semantic HTML, labelled form controls, visible focus states, colour contrast that meets WCAG AA.

## 8. Testing and quality

| Layer | Tool | What is tested |
| --- | --- | --- |
| API unit + integration | Vitest + Supertest | Validation, auth, RBAC, each module's endpoints against a test database |
| Front end | Vitest + Testing Library | Key components, forms and route guards |
| AI service | pytest | Preprocessing, inference output shape, safety thresholds |
| Static checks | ESLint, Prettier, TypeScript | Run on every push via GitHub Actions |

## 9. Deployment

`docker-compose.yml` runs four containers: `db` (MySQL 8), `ai` (FastAPI), `api` (Express) and `web` (static build served by Nginx, which also proxies `/api` to the API). Configuration is passed through environment variables; `.env.example` documents every variable.
