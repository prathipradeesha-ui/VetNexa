# Dog and cat image collection – evidence

This folder documents where every image came from and why each source was used or rejected.
The images themselves stay out of Git (`services/ai/data/`); these files let anyone trace and
re-create the collection.

## Policy: verified original data only

Decided on 21 November 2026. The collection contains **only images published by the people who
took them** (for example a research institute with a DOI and an owner-consent statement), or
data supplied directly by a veterinary clinic.

Community datasets on Kaggle and Roboflow were researched, downloaded and inspected, but are
**not used**. Inspection found that they re-publish photos their uploaders do not own:

- stock photos with Shutterstock, Alamy, Getty Images and CanStockPhoto watermarks;
- photos from veterinary websites (e.g. marked "© SeniorTailWaggers.com");
- a Kaggle "CC0" set that re-uploads the Mendeley CC BY 4.0 dataset under a different licence;
- collages, photos with drawings on them, and rotated or cropped augmented copies;
- cows, buffalo and people in sets described as dog or cat data.

An uploader's licence cannot cover photos they did not take, so these sets cannot serve as
evidence of real, lawfully used data. The full inspection record is kept below.

## Files

| File | Contents |
| --- | --- |
| `sources.json` | Every source considered: link, licence, labels, date checked, provenance level, inspection notes and the include/exclude decision with its reason. |
| `manifest.csv` | One row per image kept: file path, category, species, original label, source, licence, path inside the download, size and SHA-256 fingerprint. |
| `excluded.csv` | Every image from a used source that was left out, and why. |
| `summary.json` | Image counts per category, species and source. |
| `species_review.csv` | Record of the manual inspection of community data (87 images): species seen, stock-photo watermarks, cropped copies. Kept as evidence for the policy above. |

## Current collection

| Category | Dogs | Source |
| --- | --- | --- |
| Healthy skin | 26 | Mendeley 10.17632/5dbht54kw7.1 |
| Allergic dermatitis | 13 | Mendeley |
| Bacterial dermatosis | 12 | Mendeley |
| Fungal infection | 11 | Mendeley |

Each image is the white-light photo of one dog. The other nine frames per dog in that dataset
are narrow-band multispectral images and are not used; 33 dogs without a label in the source's
label file are excluded.

**Requested:** PetWound (290 photos of real wounds on 208 dogs and 82 cats, *Animals* 2023,
13(6), 956) from its authors, and clinical photos from a partner veterinary clinic. Both would
be verified original data.

## Community collection (second tier)

At the project owner's request (21–22 November 2026) the real dog and cat photos from open-licence
community datasets were also collected. They are kept **separate** from the verified collection
above and are never mixed with it:

| | Verified | Community |
| --- | --- | --- |
| Folder | `data/dogs-cats/` | `data/dogs-cats-community/` |
| Records | `datasets/manifest.csv`, `excluded.csv`, `summary.json` | `datasets/community/` (same files) |
| Sources | Published by the people who took the photos | Kaggle and Roboflow uploads under CC BY 4.0, CC0, Apache 2.0 or public domain; the photographers cannot be confirmed |
| Labels | From the source | From the uploaders, mapped to shared categories; **not checked by a veterinarian** |

Build it with `python -m vetnexa_ai.curation --tier community`. The images stay out of Git;
`manifest.csv` records, for every kept image, its source, licence, original label and SHA-256
fingerprint, and `excluded.csv` records every image left out and why.

### What was removed

From 6,012 downloaded files, **616 distinct, clear, real dog and cat photos** were kept.

| Removed | Images | How |
| --- | ---: | --- |
| Duplicates: augmented, flipped, rotated, cropped or noisy copies; video frames of the same case; copies of verified photos | 4,433 | Exact and difference hashes, rotation-corner check, artificial speckle-noise check, and EfficientNet-B0 image features: a photo at least 0.70 similar to one already kept counts as the same case |
| Not clear: blurry, too small, too dark, washed out, pixelated enlargements, unrecognisable close-ups | 223 | Sharpness, size and exposure checks (sharpness at least 35), then by eye |
| Not a real photo: drawings on the image, collages, cut-outs, colour-altered or upside-down copies, multispectral frames, graphics | 196 | Automatic checks, then by eye |
| No usable label | 167 | Images without a label, or labelled only "Unlabeled" |
| Not a dog or cat (cows, buffalo, goats, people, an African wild dog) | 158 | Labels, an image check, then by eye |
| Watermarks, captions, logos and image credits (Shutterstock, Alamy, iStock, Depositphotos, 123RF, Bigstock, CanStockPhoto, SeniorTailWaggers, KineMaster, news and university marks) | 144 | By eye; copies of rejected photos are removed automatically |
| Figures scanned from a published veterinary textbook (ISBN in the file name) | 74 | File name; the publisher holds the copyright |

Every kept image was looked at on numbered contact sheets (`_check/sheet_*.jpg`, made with
`python -m vetnexa_ai.review_sheets --tier community`). Each decision is recorded in
`species_review.csv` (columns `species`, `watermark`, `duplicate_of`, `exclude`, `note`), and a
rebuild applies them, including to any near-copy of a rejected photo.

### Contents and use in VetNexa

| Category | Dog | Cat | Use |
| --- | ---: | ---: | --- |
| `wound_injury` | 17 | 15 | Real injured animals: test the wound check and its unfamiliar-photo detector on real photos |
| `uninjured` | 18 | 26 | Whole animals without injuries: real "healthy" examples |
| `healthy_skin` | 114 | – | Healthy skin and coat |
| `ringworm` | 94 | – | Skin conditions: for the planned skin-condition classes and to check the symptom questions |
| `mange_scabies` | 112 | – | 〃 |
| `fungal_infection` | 94 | – | 〃 |
| `dermatitis` | 80 | – | 〃 |
| `allergic_dermatitis` | 25 | – | 〃 |
| `bacterial_dermatosis` | 20 | – | 〃 |
| `alopecia` | – | 1 | 〃 |

Sources kept: Kaggle *Dog's skin diseases* (youssefmohmmed, Apache 2.0) 469; Kaggle *Dogs skin
disease* (yashmotiani, CC0) 70; Roboflow *Injury Classifier* (RESQPETAI, CC BY 4.0) 62; Roboflow
*injured dog detector* (AnimalWounded, CC BY 4.0) 7; Roboflow *injured animal detector2* (school,
CC BY 4.0) 7; Roboflow *Cat skin disease* (FYP, CC BY 4.0) 1. Credit each source as its licence
requires (links in `sources.json`).

**Limits.** The wound photos show injuries but are not typed (cut, puncture, abscess), so they
cannot train the five wound classes directly; a veterinarian would need to label them. The skin
labels come from uploaders and may be wrong. Cats are under-represented. Results from this tier
must be reported as community data, never as verified clinical data.

**Still to add.** Several open sets were found and checked but could not be downloaded through the
browser (downloads stalled): Roboflow *Dog Skin Disease Dataset* (1,418 images), *Dog Skin Disease
Prediction* (361), *Dog Skin Diseases* (618), *Cat Skin Disease* (kat, 983; bios, 348), *Cat
Infections* (96) and three more injured-animal sets. They are recorded in `sources.json`; once a
zip is placed in `data/raw/<source id>/`, a rebuild includes it with the same checks.

## Re-creating the collection

```bash
cd services/ai
# download each included source into data/raw/<source id>/ (links in sources.json), then:
python -m vetnexa_ai.curation
```

Images appear in `data/dogs-cats/<category>/<species>/`, with contact sheets in
`data/dogs-cats/_previews/`. The tool also supports a second, clearly labelled tier of
community data by adding `"uploader-asserted"` to `ACCEPTED_PROVENANCE` in `curation.py`.

## Attribution

Mendeley images: Korea Institute of Toxicology, *Classification of pet dog skin diseases using
deep learning with images captured from multispectral imaging device*, Mendeley Data, V1,
doi:10.17632/5dbht54kw7.1, licensed CC BY 4.0. Credit the authors and link to the source when
showing these images.
