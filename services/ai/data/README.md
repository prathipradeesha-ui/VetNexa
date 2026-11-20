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

Use only images you are allowed to use, and record where each one came from.

| Source | Notes |
| --- | --- |
| Photos collected with clinics or rescuers | Best quality. Get written owner consent, remove faces, people and house numbers, and get your university's ethics approval first. |
| PetWound dataset (dog and cat wounds, CC BY 4.0) | About 290 images, labelled for segmentation; needs re-labelling into the classes above. Credit the authors. |
| Roboflow "injured dog detector" sets (CC BY 4.0) | Small; labels are only injured / not injured. Credit the uploaders. |
| Human wound datasets on Roboflow (CC BY 4.0) | Right wound types, wrong species: use only for the first stage of two-stage training, never for evaluation. |

Check the licence on each dataset's own page before downloading, as uploader labels can be wrong.
Results must always be **evaluated on dog and cat photos only**.
