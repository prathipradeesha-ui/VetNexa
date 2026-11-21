# VetNexa – Project Plan

VetNexa is built incrementally. Each stage is implemented, tested and committed before the next one begins.

## Stages

| #   | Stage                             | Main deliverables                                                                  | Status      |
| --- | --------------------------------- | ---------------------------------------------------------------------------------- | ----------- |
| 1   | Planning and architecture         | Architecture document, project plan, repository conventions                        | Done        |
| 2   | Brand identity                    | Logo set (full, mark, mono, favicon), colour palette, typography, brand guidelines | Done        |
| 3   | Monorepo setup                    | npm workspaces, TypeScript config, ESLint, Prettier, shared package                | Done        |
| 4   | Database design                   | Prisma schema, migrations, realistic seed data                                     | Done        |
| 5   | API foundation                    | Express app, error handling, logging, health check, test setup                     | Done        |
| 6   | Authentication and RBAC           | Register, login, logout, current user, role guards, tests                          | Done        |
| 7   | Front-end foundation              | Vite app, design tokens, layout, navigation, public pages                          | Done        |
| 8   | Pet profiles                      | CRUD API + UI, photo upload                                                        | Done        |
| 9   | Health records                    | Vaccinations, treatments, medical history timeline                                 | Done        |
| 10  | Clinic discovery                  | Search, filters, clinic detail page, reviews and ratings                           | Done        |
| 11  | Veterinary portal                 | Consultations, vet dashboard, treatment notes                                      | Done        |
| 12  | Rescue and adoption               | Rescue reports, adoption listings, applications                                    | Done        |
| 13  | AI service – wound model          | Dataset preparation, OpenCV preprocessing, PyTorch training and evaluation         | In progress |
| 14  | AI wound assessment integration   | Inference API, upload flow, results with uncertainty and guidance                  | Done        |
| 15  | AI chatbot                        | Knowledge base, retrieval, chat UI with safety redirects                           | Done        |
| 16  | Admin dashboard                   | User and vet verification, clinic and content management, statistics               | Planned     |
| 17  | Containerisation                  | Dockerfiles, Docker Compose for all services                                       | Planned     |
| 18  | Continuous integration            | GitHub Actions: lint, type-check, tests                                            | Planned     |
| 19  | Security and accessibility review | Hardening, audit fixes, accessibility pass                                         | Planned     |
| 20  | Final documentation               | User guide, setup guide, AI evaluation report                                      | Planned     |

## Working conventions

- **Branching:** `main` always contains working code. Larger features are developed on `feature/<name>` branches and merged when tested.
- **Commits:** small and focused, written in the imperative mood using the Conventional Commits style, for example `feat(pets): add pet profile form` or `fix(auth): reject expired tokens`.
- **Definition of done** for every stage:
  1. Feature works end to end in the browser.
  2. Automated tests written and passing.
  3. Lint and type-check pass.
  4. Documentation updated where relevant.
