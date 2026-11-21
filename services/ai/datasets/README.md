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
