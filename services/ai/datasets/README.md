# Dog and cat image collection – evidence

This folder documents where every training image came from. The images themselves stay out of
Git (`services/ai/data/`), but these files let anyone trace and re-create the collection.

| File | Contents |
| --- | --- |
| `sources.json` | Every source considered, with its link, licence, labels, the date it was checked, and whether it was included or excluded (and why). |
| `manifest.csv` | One row per image kept: file path, category, species, original label, source, licence, original path inside the download, size and SHA-256 fingerprint. |
| `excluded.csv` | Every image left out and the reason (unlabelled, not a dog or cat, duplicate, augmented copy, too small, unreadable). |
| `summary.json` | Image counts per category, species and source. |

## Rules

1. **Dogs and cats only.** Images of people or other animals are removed.
2. **Real photographs only.** Augmented copies (flipped, rotated or re-coloured versions some
   datasets add) and the same photo appearing in several datasets are removed, using a SHA-256
   file hash, Roboflow's original-file name and a 256-bit perceptual hash that also checks
   flipped and rotated versions.
3. **Reusable licences only** (CC0, Public Domain, CC BY 4.0, Apache 2.0). Sources with an
   unknown or missing licence are excluded. Nothing is scraped from general websites.
4. Files are copied byte for byte, never edited, so each one can be matched to its source.

## Re-creating the collection

```bash
cd services/ai
# download each included source into data/raw/<source id>/ (links in sources.json), then:
python -m vetnexa_ai.curation
```

The organised images appear in `data/dogs-cats/<category>/<species>/`, with contact sheets
in `data/dogs-cats/_previews/`.

## Attribution

Images are used under the licences listed in `sources.json`. When showing or publishing them,
credit the dataset authors and link to the source, as CC BY 4.0 requires.
