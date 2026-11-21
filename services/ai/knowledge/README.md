# Pet-care knowledge base

The VetNexa assistant answers only from these articles. It does not generate free text, so every
answer can be traced to a written, reviewable source.

**Review status:** written by the project developer from the sources listed in each article.
The content is general educational information and **must be reviewed by a veterinarian**
before real-world use.

## Article format

One Markdown file per topic:

```markdown
---
id: heatstroke                         # unique, matches the file name
title: Heatstroke
species: dog, cat                      # who the article applies to
category: Emergencies
urgency: emergency                     # routine | see-vet | emergency
keywords: heat, panting, hot car       # words owners might use (helps retrieval)
questions: Q1 | Q2 | Q3                # example questions; the first is offered as a suggestion
sources: Source one | Source two       # further reading, shown with every answer
---

## Summary

One paragraph, always shown first.

## What you can do

- Bullet points become a list in the chat.
```

Headings starting with **"Get help now"** are highlighted as urgent in the chat interface.

## Adding or changing an article

1. Add or edit the file and keep statements cautious and general (no doses, no diagnoses).
2. Add typical owner questions to `tests/test_chat.py` so retrieval is tested.
3. Run `pytest tests/test_chat.py`. The service loads the articles when it starts.
