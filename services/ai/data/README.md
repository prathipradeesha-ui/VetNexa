# Wound image data

Images are **not stored in Git** (they are large, and photos of animals and their owners' homes
can be personal). Only this guide is committed.

## Folder layout

```
data/wounds/
  abrasion/
  laceration/
  puncture_wound/
  abscess_or_infection/
  healthy_skin/
```

- One folder per class, using exactly these names (see `vetnexa_ai/config.py`).
- JPG, PNG or WebP. At least 224 × 224 pixels; ordinary phone photos are ideal.
- **Several photos of the same wound** must share a prefix followed by two underscores, for
  example `case014__1.jpg`, `case014__2.jpg`. The split keeps them together, so the model is never
  tested on a near-copy of a wound it trained on.
- Exact duplicate files are skipped automatically.

## Labelling

- Each photo should be labelled by, or checked by, a veterinarian. Label the **main** problem
  visible in the photo; leave out photos where the wound type cannot be judged from the image.
- Keep a simple spreadsheet of who labelled each case and any disagreements. It is needed to
  describe label quality in the evaluation.

## Sources, licences and consent

**Policy: verified original data only.** Use only images published by the people who took them
(a research group with a DOI and consent statement) or supplied directly by a veterinary clinic
with owner consent. Community uploads on Kaggle and Roboflow are not used: inspection found
they contain stock and website photos their uploaders do not own. The full record is in
`../datasets/` (see `datasets/README.md`).

| Source | Status |
| --- | --- |
| Mendeley 10.17632/5dbht54kw7.1 (dog skin, CC BY 4.0) | In use: 62 dogs, 4 skin conditions |
| PetWound (208 dogs and 82 cats with real wounds) | Requested from the authors |
| Partner veterinary clinic | Requested. Needs written owner consent, removal of faces, people and house numbers, and university ethics approval |

Results must always be **evaluated on dog and cat photos only**.
