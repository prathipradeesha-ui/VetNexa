# Security and Accessibility Review (Stage 25)

Review of VetNexa carried out on 21 November 2026, after all features up to Stage 24 and the
offline emergency help were finished. It covers the dependencies, the API, the web app and the
Docker set-up, and an accessibility check of every main page. Each problem found was fixed and
a test was added so it cannot come back.

## Summary

| Area                     | Result                                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------- |
| Node.js dependencies     | 1 high-severity advisory (via the Prisma CLI) **fixed**; `npm audit` now reports 0 problems |
| Python dependencies      | `pip-audit`: no known vulnerabilities (torch and torchvision checked by their PyPI version) |
| Access between users     | Every route that takes an ID checked; no leaks found; missing tests **added**               |
| Request handling         | Form posts and wildcard CORS **closed**                                                     |
| Passwords                | Byte-length gap with bcrypt **fixed**                                                       |
| Secrets in Git           | None found                                                                                  |
| Accessibility (axe-core) | 151 contrast problems from 6 colours, 3 heading and landmark problems: **all fixed**        |
| Reflow at 320 px (400 %) | No page scrolls sideways                                                                    |
| Accessibility in CI      | axe-core now checks the main public pages in every test run                                 |

## 1. Security

### 1.1 Dependencies

| Check                            | Finding                                                                                                                  | Action                                                                                                   |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `npm audit`                      | `effect` ≤ 3.22.0 (ReDoS, GHSA-7589-6fvf-x4pw), pulled in by `@prisma/config`, reported three times                      | Pinned `effect` 3.22.5 with an npm override; Prisma validate, generate, migrate and all tests still pass |
| `npm audit fix --force`          | Would have downgraded Prisma 7 to 6                                                                                      | Not used                                                                                                 |
| `pip-audit -r requirements.txt`  | No known vulnerabilities                                                                                                 | –                                                                                                        |
| torch 2.15.0, torchvision 0.29.2 | The `+cpu` builds cannot be looked up automatically, so the same versions were audited by name: no known vulnerabilities | –                                                                                                        |

Dependabot keeps watching npm, pip, Docker and GitHub Actions every week.

### 1.2 API review

| Topic                | What was checked                                                                                                             | Result                                                                                    |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Sessions             | JWT (HS256, issuer checked) in an `HttpOnly`, `SameSite=Lax` cookie, `Secure` in production; user re-loaded on every request | Good: suspension and role changes apply at once                                           |
| Passwords            | bcrypt cost 12; same response time and message for unknown emails and wrong passwords                                        | Good. **Fixed:** passwords over 72 bytes are now refused (see 1.3)                        |
| Access between users | All 35 routes with an ID in the URL, and the service code behind them                                                        | Good: someone else's item is always "not found" (or "forbidden" where the item is public) |
| Cross-site requests  | CORS origin list, cookie `SameSite`, body parsers                                                                            | **Fixed:** HTML form posts are no longer read; `CORS_ORIGIN=*` is refused                 |
| Input validation     | Zod schemas on every body, query and URL parameter                                                                           | Good                                                                                      |
| Uploads              | Size limit, type check, then decoded and re-encoded by sharp (removes GPS data), random names, private bucket                | Good: renamed non-images are rejected                                                     |
| SQL injection        | Prisma only; the one raw query is the fixed `SELECT 1` health check                                                          | Good                                                                                      |
| Rate limits          | General, sign-in, contact, reviews, rescue, adoption, AI, chat and emergency limits                                          | Good                                                                                      |
| Error messages       | Central handler; unexpected errors are logged but users see a generic message                                                | Good: no stack traces (now tested)                                                        |
| Web app              | No `dangerouslySetInnerHTML`; redirect after sign-in only uses in-app router state                                           | Good: no XSS sink or open redirect                                                        |
| Offline data         | Service worker never stores `/api` or `/uploads`; only the public clinic list and unsent rescue reports stay on the phone    | Good                                                                                      |
| Secrets              | Searched the Git history for keys, private keys and `.env` files                                                             | None found                                                                                |

### 1.3 Fixes made

| Commit    | Fix                                                                                                                                      |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `9ec3b25` | Use the patched `effect` library under Prisma                                                                                            |
| `3af7d87` | The API only reads JSON, so a form on another website cannot post data with a visitor's session; a wildcard `CORS_ORIGIN` stops start-up |
| `7e8d60a` | bcrypt only checks the first 72 bytes. Sinhala, Tamil and emoji characters take 3–4 bytes, so such long passwords are now refused        |
| `cc5cb04` | New tests: wound checks, pet and rescue photos and adoption applications cannot be reached by other users; errors never show internals   |
| Stage 26  | Found while writing the setup guide: MySQL was published on every network interface; it now listens on this computer only (`127.0.0.1`)  |

### 1.4 Remaining risks and advice for deployment

| Risk                                                                                               | Why it is accepted now                                                                           | Recommended before going live                                                                                     |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| Signing out removes the cookie, but a copied session token stays valid until it expires (12 hours) | The cookie is `HttpOnly`, so page scripts cannot copy it; suspended accounts are blocked at once | Add a session version to each user, so "sign out everywhere" and password changes end all sessions                |
| The Docker stack serves plain HTTP on `localhost`                                                  | Development and demonstration only                                                               | Put it behind HTTPS (for example a reverse proxy with Let's Encrypt) and add `Strict-Transport-Security` in Nginx |
| The AI service token is optional                                                                   | The AI service is only reachable on the internal Docker network                                  | Set `AI_SERVICE_TOKEN` in `.env`                                                                                  |
| "This email is already registered" tells someone that an account exists                            | Common on sign-up pages and limited to 10 attempts per 15 minutes                                | Send a confirmation email instead if accounts become sensitive                                                    |
| Demo accounts with a published password                                                            | Seed data for development only                                                                   | Never run the seed in production                                                                                  |

## 2. Accessibility

### 2.1 How it was tested

- **axe-core 4.14** (WCAG 2.0, 2.1 and 2.2 A and AA rules, plus best practices) run in a real
  browser (Microsoft Edge) on the production build in Docker.
- **55 page views:** every public page at desktop width and at 320 px, a clinic page, an
  adoption listing, the sign-in, sign-up and contact forms with their error messages showing,
  the chat panel and mobile menu open, every pet-owner page at desktop width and at 320 px, the
  pet detail page, the phone drawer and every admin page.
- **Reflow:** at 320 px wide (the same as 400 % zoom on a laptop) no page may scroll sideways.
- **By hand:** keyboard focus styles, reduced motion and Windows high contrast mode.

### 2.2 Problems found and fixed (`0dbcdb1`)

| Problem                                                                         | Pages                             | Fix                                                              |
| ------------------------------------------------------------------------------- | --------------------------------- | ---------------------------------------------------------------- |
| Light Slate `#6B7A8F` text: 4.36 : 1 on white and 4.08 : 1 on Mist (132 places) | Admin tables, dates, hints, forms | Darkened to `#5E6D82` (5.27 : 1 on white, 4.92 : 1 on Mist)      |
| "Photo coming soon" at 75 % opacity: 3.31 : 1                                   | Adoption                          | Full Deep Teal (5.37 : 1)                                        |
| Mint accent tagline on Deep Teal: 3.64 : 1                                      | Sign in, create account           | Soft Mint (about 5 : 1)                                          |
| Warning amber `#B7791F`: 3.64 : 1                                               | "Due soon" on pet cards           | Darkened to `#946116` (5.28 : 1, 4.83 : 1 on its own background) |
| Large "404" in mint: 1.7 : 1                                                    | Page not found                    | Deep Teal                                                        |
| Assistant answers jumped from heading level 1 to 3                              | Ask VetNexa page                  | Hidden "Conversation" heading for screen readers                 |
| The chat panel's top bar was a second page `header` (banner landmark)           | Every page with the chat open     | Changed to a plain block                                         |
| Focus rings are drawn with a shadow, which Windows high contrast mode removes   | All pages                         | A real outline in forced-colours mode                            |

After the fixes all 55 page views were checked again: **no problems remain** and nothing
scrolls sideways at 320 px. The brand guidelines were updated with the new colour values.

### 2.3 Already in place

Skip link to the main content; one `h1` per page; labelled form fields with errors linked to
their field; visible focus on every control; Escape closes menus, the drawer and the chat;
`role="status"` and `aria-live` for results, the offline banner and chat answers; status
colours always come with an icon or text; animations turned off when the device asks for
reduced motion; the photo check and danger-sign results are text, not colour alone.

### 2.4 Kept in CI (`a7567a4`)

`apps/web/src/test/a11y.test.tsx` runs axe-core on nine public pages (home, about, clinics,
adoption, emergency, contact, sign in, create account and page not found) in every test run.
Colour contrast cannot be measured in the test browser, so it is repeated in a real browser
whenever colours change.

### 2.5 Not covered

The review used automated checks and keyboard testing. It has not yet been tested with a
screen reader user or with people with low vision; that would be the next step before real
use. The AI explanation panel ("Why this result") is text and tables, but whether owners
understand it has not been studied.
