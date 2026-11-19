# VetNexa – REST API Reference

Base URL (local): `http://localhost:4100/api`

All requests and responses use JSON. Authenticated routes rely on the `vetnexa_session`
HttpOnly cookie set by login or registration, so browser clients must send requests with
`credentials: 'include'`.

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
| 409    | `CONFLICT`          | Duplicate record, e.g. email already registered                   |
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

## Administration

All routes require the `ADMIN` role.

| Method | Path                               | Description                                               |
| ------ | ---------------------------------- | --------------------------------------------------------- |
| GET    | `/admin/vets/pending`              | Veterinarians waiting for licence verification.           |
| PATCH  | `/admin/vets/:userId/verification` | Body `{ "approved": true }` to verify, `false` to revoke. |

## Access control summary

| Rule                                                                                  | Where it is enforced             |
| ------------------------------------------------------------------------------------- | -------------------------------- |
| Session must be valid and not expired                                                 | `authenticate` middleware        |
| User is re-loaded on every request, so suspensions and role changes apply immediately | `authenticate` middleware        |
| Route limited to certain roles                                                        | `authorize(...roles)` middleware |
| Vets need admin verification before seeing clinical data                              | `requireVerifiedVet` middleware  |
| Password hash never leaves the API                                                    | `toPublicUser` serializer        |
