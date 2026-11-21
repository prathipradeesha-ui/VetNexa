# VetNexa – Brand Guidelines

## 1. Brand idea

**VetNexa** joins _Vet_ (veterinary care) with _Nexa_ (from "nexus", a point of connection). The platform is where owners, vets, clinics and rescuers meet around one goal: healthier, safer animals.

**Tagline:** Care · Connect · Protect

**Personality:** trustworthy, calm, knowledgeable, warm. VetNexa speaks like a good vet nurse: clear, kind and never alarmist.

## 2. Logo

The mark is a paw print whose main pad carries a medical cross, set inside a rounded teal tile.

- **Paw** – animals and animal welfare.
- **Cross in the pad** – veterinary healthcare, built into the animal rather than placed beside it.
- **Rounded tile** – a friendly, app-like container that works as a favicon and mobile icon.
- **Mint connection dot** – the "Nexa" element: the connected network of people and the AI support behind the platform.

### Files (`/brand`)

| File                     | Use                                                                          |
| ------------------------ | ---------------------------------------------------------------------------- |
| `logo-full.svg`          | Default horizontal logo: website header, documents.                          |
| `logo-full-reversed.svg` | On Deep Teal or Navy backgrounds: footer, login hero panel.                  |
| `logo-stacked.svg`       | Centred layouts: login and registration pages, splash screens.               |
| `logo-mark.svg`          | Icon only: mobile header, app icon, social avatars.                          |
| `favicon.svg`            | Browser tab icon (simplified, no connection dot so it stays crisp at 16 px). |
| `logo-mono.svg`          | Single colour (Navy) for print, stamps and certificates.                     |

### Usage rules

- Keep clear space around the logo equal to the height of the cross in the mark.
- Minimum size: mark 24 px, full logo 120 px wide.
- Do not recolour, stretch, rotate, add shadows or place the full-colour logo on busy photographs.
- The wordmark uses Plus Jakarta Sans ExtraBold. "Vet" is Navy, "Nexa" is Deep Teal.

## 3. Colour palette

| Token                  | Name              | Hex       | Use                                                                       |
| ---------------------- | ----------------- | --------- | ------------------------------------------------------------------------- |
| `--color-primary`      | Deep Teal         | `#0A6C6C` | Dominant brand colour: primary buttons, active navigation, links, key UI. |
| `--color-primary-dark` | Deep Teal (hover) | `#08595A` | Hover and pressed states.                                                 |
| `--color-navy`         | Navy Blue         | `#13294B` | Headings, sidebar, strong text, footer.                                   |
| `--color-white`        | White             | `#FFFFFF` | Page backgrounds, cards, forms.                                           |
| `--color-mint`         | Soft Mint         | `#DDF3EC` | Subtle highlighted backgrounds, success badges, selected rows.            |
| `--color-mint-strong`  | Mint accent       | `#7FD6C2` | Accent on dark backgrounds, logo connection dot.                          |
| `--color-turquoise`    | Muted Turquoise   | `#4FB3AE` | Secondary interactive details, charts, focus rings.                       |
| `--color-surface`      | Mist              | `#F4F8F8` | App background behind cards.                                              |
| `--color-text`         | Ink               | `#1C2B3A` | Body text.                                                                |
| `--color-text-muted`   | Slate             | `#4A5B73` | Secondary text and labels.                                                |
| `--color-text-subtle`  | Light Slate       | `#5E6D82` | Hints, dates and table headings (the lightest text that still passes AA). |
| `--color-border`       | Line              | `#DCE5E8` | Borders and dividers.                                                     |

**Status colours** (used sparingly, always with an icon or text, never colour alone):

| Status          | Hex       |
| --------------- | --------- |
| Success         | `#1E8E5A` |
| Warning         | `#946116` |
| Danger / urgent | `#C2412D` |
| Info            | `#2B6CB0` |

Contrast checks: white text on Deep Teal is about 6.1 : 1 and Navy on white about 14 : 1, both above the WCAG AA requirement of 4.5 : 1. The Mint accent is only for icons and large shapes on dark backgrounds; small text on Deep Teal uses Soft Mint (about 5 : 1). Light Slate and Warning were darkened in the accessibility review (Stage 25) so every text colour reaches 4.5 : 1.

## 4. Typography

- **Plus Jakarta Sans** (Google Fonts) for headings and UI. Weights 400, 500, 600, 700, 800.
- System fallback: `'Segoe UI', Roboto, Arial, sans-serif`.
- Base size 16 px, line height 1.55 for body text.

| Style          | Size / weight                 |
| -------------- | ----------------------------- |
| Display (hero) | 44 px / 800 (30 px on mobile) |
| H1             | 32 px / 700                   |
| H2             | 24 px / 700                   |
| H3             | 19 px / 600                   |
| Body           | 16 px / 400                   |
| Small / labels | 14 px / 500                   |

## 5. Interface style

- Spacing on a 4 px grid (4, 8, 12, 16, 24, 32, 48, 64).
- Corner radius: 8 px for inputs and buttons, 14 px for cards.
- Flat surfaces with a single soft shadow for raised cards; no decorative gradients.
- Icons: Lucide outline icon set, 1.75 px stroke.
- Photography: real, well-lit photos of dogs and cats; avoid dramatic or graphic injury images on public pages.
- Motion: short (150–200 ms) transitions on hover and focus only; respect `prefers-reduced-motion`.

## 6. Voice for AI features

- Always say the result is a **preliminary assessment**.
- Show confidence plainly ("The model is 72% confident").
- Never use the words "diagnosis" or "cure" for AI output.
- When in doubt, recommend a veterinarian and link to Clinic Discovery.
