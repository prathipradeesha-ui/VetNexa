# VetNexa – REST API Reference

Base URL (local): `http://localhost:4100/api`

All requests and responses use JSON. Authenticated routes rely on the `vetnexa_session`
HttpOnly cookie set by login or registration, so browser clients must send requests with
`credentials: 'include'`.

## Species

VetNexa is for dogs and cats only. Every `species` field accepts `DOG` or `CAT`; any other
value is rejected with `422`.

## Error format

Every error has the same shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Some fields are invalid",
    "details": [{ "field": "email", "message": "Enter a valid email address" }]
  }
}
```

| Status | Code                | Meaning                                                           |
| ------ | ------------------- | ----------------------------------------------------------------- |
| 400    | `BAD_REQUEST`       | Malformed request, e.g. invalid JSON                              |
| 401    | `UNAUTHORIZED`      | Not signed in, or the session expired                             |
| 403    | `FORBIDDEN`         | Signed in but not allowed (wrong role, suspended, unverified vet) |
| 404    | `NOT_FOUND`         | Route or record does not exist                                    |
| 409    | `CONFLICT`          | Duplicate record, e.g. email already registered (with `details`)  |
| 422    | `VALIDATION_ERROR`  | Field validation failed; see `details`                            |
| 429    | `TOO_MANY_REQUESTS` | Rate limit reached                                                |
| 500    | `INTERNAL_ERROR`    | Unexpected server error (details are logged, not returned)        |

## Health

| Method | Path      | Access | Description                                                               |
| ------ | --------- | ------ | ------------------------------------------------------------------------- |
| GET    | `/health` | Public | API and database status. 200 when healthy, 503 when the database is down. |

## Authentication

| Method | Path             | Access    | Description                                                                          |
| ------ | ---------------- | --------- | ------------------------------------------------------------------------------------ |
| POST   | `/auth/register` | Public    | Create an OWNER, VET or RESCUER account and sign in. Vets must send `licenseNumber`. |
| POST   | `/auth/login`    | Public    | Sign in with `email` and `password`.                                                 |
| POST   | `/auth/logout`   | Public    | Clear the session cookie.                                                            |
| GET    | `/auth/me`       | Signed in | The current user's profile.                                                          |

Sign-in and sign-up allow 10 failed attempts per 15 minutes per IP address.

**Register body**

```json
{
  "firstName": "Nimali",
  "lastName": "Perera",
  "email": "nimali@example.com",
  "phone": "0771234567",
  "password": "Secure123",
  "confirmPassword": "Secure123",
  "role": "OWNER"
}
```

**User response**

```json
{
  "user": {
    "id": "cm…",
    "email": "nimali@example.com",
    "firstName": "Nimali",
    "lastName": "Perera",
    "fullName": "Nimali Perera",
    "phone": "0771234567",
    "role": "OWNER",
    "status": "ACTIVE",
    "city": null,
    "avatarUrl": null,
    "createdAt": "2026-11-19T17:00:00.000Z",
    "vetProfile": null
  }
}
```

## Clinics and reviews

Directory results include `latitude` and `longitude` (clinics are public places) for the
map and "near me" sorting, which happens in the browser.

Public, except writing reviews.

| Method | Path                          | Access           | Description                                                                              |
| ------ | ----------------------------- | ---------------- | ---------------------------------------------------------------------------------------- |
| GET    | `/clinics`                    | Public           | Search. Query: `q`, `city`, `service`, `emergency`, `openNow`, `sort` (`rating`/`name`). |
| GET    | `/clinics/:slug`              | Public           | Details, hours, verified vets, rating breakdown, reviews; `myReview` when signed in.     |
| PUT    | `/clinics/:slug/reviews/mine` | Owner or rescuer | Write or replace my review (`rating` 1–5, optional `title`, `comment`).                  |
| DELETE | `/clinics/:slug/reviews/mine` | Signed in        | Delete my review.                                                                        |

- "Open now" is calculated in Sri Lanka time (`Asia/Colombo`) from each clinic's weekly hours.
- `emergency=true` includes clinics that are open 24 hours.
- One review per user per clinic; the cached `averageRating` and `reviewCount` are recalculated
  in the same transaction as each change. Reviewers are shown as first name and initial.
- Veterinarians and administrators cannot review clinics (conflict of interest).
- Review saves are limited to 10 per hour per IP address.

## Consultations and the veterinary portal

Owners and **verified** vets only. Every user sees only consultations they take part in;
anything else returns `404`. Unverified vets receive `403` on all of these routes.

| Method | Path                          | Access     | Description                                                        |
| ------ | ----------------------------- | ---------- | ------------------------------------------------------------------ |
| GET    | `/vets`                       | Signed in  | Verified vets that can be booked, with their clinic.               |
| GET    | `/consultations?view=`        | Owner, vet | `upcoming` (default), `requests`, `past` or `all`.                 |
| POST   | `/consultations`              | Owner      | Request: `petId`, `vetId`, `type`, `date`, `time`, `reason`.       |
| GET    | `/consultations/:id`          | Owner, vet | One consultation, including the viewer's `actions`.                |
| PATCH  | `/consultations/:id/status`   | Owner, vet | `{ status: "CONFIRMED" \| "CANCELLED", note? }`.                   |
| POST   | `/consultations/:id/complete` | Vet        | `diagnosis`, `treatment`, optional `vetNotes`, `followUpDate`.     |
| GET    | `/vet/summary`                | Vet        | Pending requests, next 7 days, completed this month, today's list. |
| GET    | `/vet/patients/:petId`        | Vet        | Patient profile and full history.                                  |

**Rules**

- `date` and `time` are Sri Lanka time; slots are every 30 minutes from 08:00 to 19:30, at
  least one hour and at most 60 days ahead. A vet cannot be booked twice within 30 minutes
  (`409`, field `time`).
- Status changes: the vet confirms `REQUESTED`; either side cancels `REQUESTED` or
  `CONFIRMED`; only the vet completes a `CONFIRMED` consultation.
- Completing adds a vet-authored `TREATMENT` record to the pet's history in the same
  transaction (owners cannot edit it), with the follow-up date as its next due date.
- A vet can open `/vet/patients/:petId` only while they have a consultation with that pet that
  was not cancelled. Owner phone and email are shared with the vet, never the other way round.

## Rescue reports

Signed in. Rescuers and administrators see the board; everyone else sees their own reports.

| Method | Path                  | Access         | Description                                                                                                                               |
| ------ | --------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/rescue?view=`       | Signed in      | `open` (default), `mine` (rescuers) or `resolved`.                                                                                        |
| POST   | `/rescue`             | Signed in      | Report an animal: `species`, `title`, `description`, `locationText`, `city`, `urgency`, optional `contactPhone`, `latitude`, `longitude`. |
| GET    | `/rescue/:id`         | Involved users | One report with the viewer's `actions`.                                                                                                   |
| POST   | `/rescue/:id/take-on` | Rescuer        | Take on an open report (only one rescuer can).                                                                                            |
| PATCH  | `/rescue/:id/status`  | Rescuer, admin | `RESCUED` or `CLOSED`; reporters may close their own open report.                                                                         |
| PUT    | `/rescue/:id/photo`   | Reporter       | Add or replace the photo.                                                                                                                 |

The board lists waiting reports first, then by urgency (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`).
Reporter phone numbers are only shown to rescuers and administrators.

**Location privacy:** the exact `latitude`/`longitude` is returned only to the reporter, the
rescuer who took the report on and administrators. Other rescuers receive the position rounded
to two decimals (about 1 km) with `locationApproximate: true` until they take the report on.
Positions must be inside Sri Lanka.

## Emergency help without an account

Public routes for emergencies, rate limited per IP address.

| Method | Path                | Description                                                                                         |
| ------ | ------------------- | --------------------------------------------------------------------------------------------------- |
| GET    | `/emergency/status` | Whether the wound check is available, and whether a demonstration model is running.                 |
| POST   | `/emergency/assess` | Wound check: multipart `photo`, `species` (`DOG` or `CAT`), optional `answers`. 10 per hour per IP. |
| POST   | `/emergency/rescue` | Rescue report with required `reporterName` and `contactPhone`. Returns a `reference`. 5 per hour.   |

The wound check result is returned once with `stored: false`: no record is created and the
photo is not saved. Guest rescue reports appear on the rescue board marked "no account", and
rescuers call the reporter back on the phone number given.

## Adoption

| Method | Path                                  | Access          | Description                                                                  |
| ------ | ------------------------------------- | --------------- | ---------------------------------------------------------------------------- |
| GET    | `/adoption/listings`                  | Public          | Filters: `species`, `ageGroup`, `city`, `goodWithChildren`.                  |
| GET    | `/adoption/listings/:id`              | Public          | Detail, plus `myApplication` and `canApply` when signed in.                  |
| GET    | `/adoption/listings/mine`             | Rescuer         | My listings with `openApplications`.                                         |
| POST   | `/adoption/listings`                  | Rescuer         | Create a listing.                                                            |
| PUT    | `/adoption/listings/:id`              | Rescuer (owner) | Update a listing.                                                            |
| PATCH  | `/adoption/listings/:id/status`       | Rescuer (owner) | `AVAILABLE` or `WITHDRAWN`.                                                  |
| PUT    | `/adoption/listings/:id/photo`        | Rescuer (owner) | Listing photo.                                                               |
| GET    | `/adoption/listings/:id/applications` | Rescuer (owner) | Applications with applicant contact details.                                 |
| POST   | `/adoption/listings/:id/applications` | Owner           | Apply: `homeType`, `hasOtherPets`, `hasChildren`, `contactPhone`, `message`. |
| GET    | `/adoption/applications/mine`         | Owner           | My applications with the rescuer's notes.                                    |
| POST   | `/adoption/applications/:id/withdraw` | Owner           | Withdraw an open application.                                                |
| PATCH  | `/adoption/applications/:id/decision` | Rescuer (owner) | `UNDER_REVIEW`, `APPROVED` or `REJECTED`, optional `rescuerNotes`.           |

**Rules**

- One application per owner per animal; a withdrawn application can be re-submitted.
- `UNDER_REVIEW` marks the listing as adoption pending. `APPROVED` marks the animal as adopted
  and, in the same transaction, closes every other open application with a short note.
  Rejecting the last application under review makes the animal available again.
- Adopted and withdrawn animals are hidden from the public but stay visible to their rescuer.
- Rescue reports and adoption applications are limited to 10 per hour per IP address.

## Contact

| Method | Path       | Access | Description                                                                                    |
| ------ | ---------- | ------ | ---------------------------------------------------------------------------------------------- |
| POST   | `/contact` | Public | Send a message from the Contact page. Linked to the account when signed in. 5 per hour per IP. |

Body: `name`, `email`, optional `phone`, `topic` (`GENERAL`, `ACCOUNT_SUPPORT`, `VET_PARTNERSHIP`,
`CLINIC_LISTING`, `RESCUE_ADOPTION`, `FEEDBACK`) and `message` (20–2000 characters).
Returns `201` with a short `reference` the sender can quote.

## Pets

All routes require the `OWNER` role. Owners only ever see their own pets; another owner's
pet ID returns `404`, so the API does not reveal that it exists.

| Method | Path                 | Description                                                         |
| ------ | -------------------- | ------------------------------------------------------------------- |
| GET    | `/pets`              | My pets, each with `recordCount` and the `nextDue` health item.     |
| POST   | `/pets`              | Add a pet. Only `name` and `species` are required.                  |
| GET    | `/pets/:petId`       | One pet.                                                            |
| PUT    | `/pets/:petId`       | Update a pet.                                                       |
| DELETE | `/pets/:petId`       | Delete a pet with its photo and health records.                     |
| PUT    | `/pets/:petId/photo` | Upload or replace the photo (`multipart/form-data`, field `photo`). |
| DELETE | `/pets/:petId/photo` | Remove the photo.                                                   |

**Photos:** JPG, PNG or WebP up to 5 MB. Every upload is decoded and re-encoded as an
800 × 800 WebP, which rejects files that are not real images and removes location (EXIF)
data from phone photos. Files get random names and are served from `/uploads/...`, streamed by
the API from the configured store: the local folder in development, a private MinIO bucket in
Docker (`STORAGE_DRIVER`, `S3_*` settings).

## Health records

`OWNER` role, own pets only. Records are always looked up through their pet.

| Method | Path                             | Description                               |
| ------ | -------------------------------- | ----------------------------------------- |
| GET    | `/pets/:petId/records`           | The pet's history, newest first.          |
| POST   | `/pets/:petId/records`           | Add a record.                             |
| PUT    | `/pets/:petId/records/:recordId` | Update a record the owner entered.        |
| DELETE | `/pets/:petId/records/:recordId` | Delete a record the owner entered.        |
| GET    | `/reminders`                     | Overdue care and care due within 60 days. |

**Body:** `type` (`VACCINATION`, `TREATMENT`, `CHECKUP`, `MEDICATION`, `ALLERGY`, `SURGERY`),
`title`, `recordDate` (not in the future), optional `nextDueDate` (after `recordDate`),
`description`, `vetName`, `clinicName`.

**Rules**

- Each record stores who created it. Records written by a veterinarian return `canEdit: false`
  and owners receive `403` if they try to change them, so the clinical history stays accurate.
- Reminders and the pet card's `nextDue` use the same rule: for each pet, type and title
  (case-insensitive) only the latest entry counts. Recording this year's vaccine therefore
  clears last year's overdue reminder.

## AI wound assessment

`OWNER` role, own dogs and cats only. The API forwards the photo to the internal AI service
(`services/ai`, see `AI_SERVICE_URL`), stores the result and returns it. The browser never talks
to the AI service directly.

| Method | Path                  | Description                                                                 |
| ------ | --------------------- | --------------------------------------------------------------------------- |
| GET    | `/assessments/status` | `{ available, demoModel, modelVersion }` – whether a model is loaded.       |
| GET    | `/assessments`        | My assessments, newest first. Optional `?petId=`.                           |
| POST   | `/assessments`        | Assess a photo: `multipart/form-data` with `photo`, `petId`, `ownerNotes?`. |
| GET    | `/assessments/:id`    | One assessment.                                                             |
| DELETE | `/assessments/:id`    | Delete an assessment and its stored photo.                                  |

**Follow-up check-ins** (same role; only the pet's owner can see or change them):

| Method | Path                          | Description                                                                                                   |
| ------ | ----------------------------- | ------------------------------------------------------------------------------------------------------------- |
| GET    | `/assessments/follow-ups`     | My follow-ups: open ones first (soonest due), then the 20 latest done.                                        |
| POST   | `/assessments/:id/follow-ups` | Plan a look again: `{ inDays }`, one of 1, 2, 3 or 7. `409` if one is already open.                           |
| PATCH  | `/assessments/follow-ups/:id` | Record how it looks: `{ progress, note? }` with `BETTER`, `SAME` or `WORSE`. Answered once; `409` after that. |
| DELETE | `/assessments/follow-ups/:id` | Cancel a follow-up.                                                                                           |

Each follow-up has `id`, `assessmentId`, `pet`, `dueAt`, `progress`, `note`, `completedAt` and
`createdAt`; every assessment also returns its `followUps`. The advice shown for each answer is
`FOLLOW_UP_ADVICE` in `packages/shared/src/schemas/follow-up.ts` ("worse" always means a vet).

**Questionnaire:** optional multipart field `answers`, a JSON string with `redFlags` (list),
`bodyLocation`, `duration`, `cause`, `signs` (list), `appetite`, `energy` and `pain`; `null`
means "not sure". Allowed values are defined in `packages/shared/src/schemas/questionnaire.ts`.
The API adds the pet's species before forwarding the answers to the AI service. Invalid answers
receive `422` (field `answers`).

**Result:** `status` (`ASSESSED` or `UNCERTAIN`), `predictedClass`, calibrated `confidence`,
`severity` (`MINOR`, `MODERATE`, `SEVERE`, `UNCERTAIN`), `referToVet`, `escalated`,
per-class `probabilities`, `summary`, `guidance`, `modelVersion`, `demoModel`, `answers`,
`symptoms` (red flags, triggered rules with reasons and weights, risk, level, completeness and
missing inputs), `triage` (`ROUTINE`, `CONSULT`, `URGENT` or `UNABLE`), `triageDetails`
(each input's risk, reliability and weight, safety overrides and fusion mode; `null` for results
stored before Stage 20), `skinCheck` and `disclaimer`.

**Skin check (advisory):** when the AI service has a skin-condition model loaded, `skinCheck`
holds `status` (`SUGGESTED`, `UNSURE` or `UNFAMILIAR`), `condition` and `label` (only when
suggested), `confidence`, `advice`, `probabilities` and `modelVersion`. It never changes
`triage`. It is `null` for older results or when no skin model is loaded.

**Rules**

- Pets that are not dogs or cats receive `422` (field `petId`); the model was not built for them.
- A blurry, dark or washed-out photo receives `422` with code `PHOTO_QUALITY` and
  `details.problems` (advice for retaking it). Nothing is stored.
- If the AI service is down or has no model, `POST` returns `503` and `/status` reports
  `available: false`; the rest of the platform keeps working.
- `demoModel: true` means the result came from a model trained on synthetic images; the
  interface then shows a clear warning that the result says nothing about the pet.
- At most 20 assessments per hour per IP address.

## Pet-care assistant

Retrieval-based assistant; see [assistant.md](assistant.md) for how answers are chosen.

| Method | Path            | Description                                                                  |
| ------ | --------------- | ---------------------------------------------------------------------------- |
| POST   | `/chat`         | Body `{ "message" }` (1–500 characters). Anyone; returns `{ reply, saved }`. |
| GET    | `/chat/history` | Signed in: my last 50 messages, oldest first.                                |
| DELETE | `/chat/history` | Signed in: delete my conversation.                                           |

**Reply:** `kind` (`answer`, `emergency`, `redirect`, `fallback`, `smalltalk`), `text`,
`emergency` (`reason`, `steps`), `article` (title, summary, sections, sources), `related`,
`suggestions`, `actions` (links into VetNexa), `score` and `disclaimer`.

**Rules**

- Visitors' questions are answered but never stored. Signed-in users' questions and answers are
  saved together in one transaction and are visible only to them.
- If the AI service is unavailable, `POST /chat` returns `503` with a message to contact a vet
  if the pet seems unwell.
- At most 30 questions per 10 minutes per IP address.

## Administration

All routes require the `ADMIN` role. Lists are paginated 20 at a time and return
`{ page, pageSize, total, pages }` alongside the items.

| Method | Path                               | Description                                                           |
| ------ | ---------------------------------- | --------------------------------------------------------------------- |
| GET    | `/admin/stats`                     | Platform counts (users, pets, clinics, AI use, rescue, adoption).     |
| GET    | `/admin/users`                     | Users; filters `q` (name or email), `role`, `status`, `page`.         |
| PATCH  | `/admin/users/:userId/status`      | Body `{ "status": "SUSPENDED" }` or `"ACTIVE"`.                       |
| GET    | `/admin/vets/pending`              | Active veterinarians waiting for licence verification.                |
| PATCH  | `/admin/vets/:userId/verification` | Body `{ "approved": true }` to verify, `false` to revoke.             |
| GET    | `/admin/clinics`                   | All clinics, including hidden ones; optional `q`.                     |
| POST   | `/admin/clinics`                   | Add a clinic.                                                         |
| GET    | `/admin/clinics/:id`               | One clinic with every field.                                          |
| PUT    | `/admin/clinics/:id`               | Edit a clinic.                                                        |
| PATCH  | `/admin/clinics/:id/active`        | Body `{ "isActive": false }` hides it from the public directory.      |
| GET    | `/admin/reviews`                   | Reviews; filter `status` (`APPROVED`, `REJECTED`), `page`.            |
| PATCH  | `/admin/reviews/:id`               | Body `{ "status": "REJECTED" }` hides, `"APPROVED"` shows again.      |
| GET    | `/admin/messages`                  | Contact messages; filter `status` (`NEW`, `IN_PROGRESS`, `RESOLVED`). |
| PATCH  | `/admin/messages/:id`              | Body `{ "status": "RESOLVED" }`.                                      |

**Rules**

- Statistics contain counts only, never personal data.
- A suspended user receives `403` on their very next request, because the session check reloads
  the account every time. Admins cannot suspend themselves or other administrators (`403`).
- Clinic slugs (public URLs) are created from the name and town, made unique, and never change
  when a clinic is edited, so shared links keep working. Hiding a clinic keeps its history.
- Clinic form: phone `0XXXXXXXXX` or `+94XXXXXXXXX`; opening hours `HH:MM-HH:MM` or `Closed`
  for each day, closing after opening; coordinates must be inside Sri Lanka; services are
  de-duplicated.
- Hiding or showing a review recalculates the clinic's average rating and review count in the
  same transaction.

## Access control summary

| Rule                                                                                  | Where it is enforced             |
| ------------------------------------------------------------------------------------- | -------------------------------- |
| Session must be valid and not expired                                                 | `authenticate` middleware        |
| User is re-loaded on every request, so suspensions and role changes apply immediately | `authenticate` middleware        |
| Route limited to certain roles                                                        | `authorize(...roles)` middleware |
| Vets need admin verification before seeing clinical data                              | `requireVerifiedVet` middleware  |
| Password hash never leaves the API                                                    | `toPublicUser` serializer        |
