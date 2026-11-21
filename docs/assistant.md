# VetNexa Pet-Care Assistant

|           |                                                                                     |
| --------- | ----------------------------------------------------------------------------------- |
| Type      | Retrieval-based assistant over a curated knowledge base (no generative model)       |
| Status    | **Research prototype. Knowledge base pending veterinary review.**                   |
| Developer | Pradeesha Baskaran                                                                  |
| Code      | `services/ai/vetnexa_ai/chat`, `services/ai/knowledge`, `apps/api/src/modules/chat` |

## Why retrieval instead of a generative chatbot

A generative language model can produce fluent but wrong medical advice that nobody has checked.
VetNexa's assistant only returns **articles written in advance**. That makes every answer
traceable to a source, reviewable by a veterinarian and testable. It runs offline at no cost
per question. The trade-off is that it cannot answer questions the knowledge base does not
cover; it then says so honestly instead of guessing.

## How a question is answered

1. **Safety triage** (`safety.py`) runs first, so its outcome always wins:
   - **Emergency** (13 rules, e.g. breathing difficulty, collapse, seizure, poisoning, heavy
     bleeding, road accident, snake bite, heatstroke, bloat, urinary blockage, pale gums): the
     reply starts with "contact a vet now", first steps and a link to emergency clinics. A
     matching first-aid article (e.g. heatstroke) is attached when there is one.
   - **Medicine or dose questions**: never answered. The owner is warned about human medicines
     and referred to a vet.
   - **A person bitten or scratched**: wash the wound for 15 minutes and see a doctor today.
   - **Human health or other species**: politely declined as out of scope.
2. **Retrieval** (`retrieval.py`): TF-IDF over words (1–2-grams) and character 3–5-grams, averaged.
   Character n-grams tolerate typos such as "vommiting". If the question names a dog or cat,
   articles for the other species are down-weighted.
3. **Answer** (`assistant.py`): if the best score is below **0.10**, an honest "I don't have
   reliable information" fallback is returned. Otherwise, the article's summary and sections,
   sources, up to two related articles as follow-up questions, and links into VetNexa (book a
   consultation, find a clinic, Wound check, rescue, adoption) are returned.

Every reply carries the disclaimer _"General information only, not veterinary advice."_

## Knowledge base

32 Markdown articles in `services/ai/knowledge/`, each with species, category, urgency
(`routine`, `see-vet`, `emergency`), keywords, example questions and further-reading sources.
Topics: vaccinations, deworming, fleas and ticks, tick fever, toxic foods, human medicines,
poisoning, heatstroke, wounds, vomiting and diarrhoea, parvovirus, appetite loss, urinary
blockage, bloat, snake bites, seizures, breathing difficulty, cat flu and kennel cough, rabies
and bites, dental care, skin, ears, eyes, limping, neutering, feeding and weight, new puppies
and kittens, senior pets, stray animals, adoption and using VetNexa. The format is described in
`services/ai/knowledge/README.md`.

## Evaluation (automated tests, `tests/test_chat.py`)

| Check                                                                   | Result          |
| ----------------------------------------------------------------------- | --------------- |
| Example questions retrieve their own article (self-retrieval)           | ≥ 90 % required |
| 22 paraphrased questions not copied from the articles → correct article | 22 / 22         |
| 13 emergency phrasings recognised                                       | 13 / 13         |
| 6 ordinary questions **not** flagged as emergencies (false alarms)      | 0 false alarms  |
| Off-topic questions (e.g. football scores) → honest fallback            | 3 / 3           |
| Medicine doses never given; human-health and other-species redirects    | Pass            |

These are development tests written by the developer, not an independent evaluation. A fair
evaluation would use questions collected from real owners and answers rated by veterinarians.

## Privacy

Visitors can use the assistant without an account; nothing they type is stored. For signed-in
users, the conversation is saved so it can be shown again, is visible only to them, and can be
deleted at any time with **Clear conversation**.

## Limitations

- English only. Sinhala and Tamil questions are not understood yet.
- Keyword-based triage can miss unusual descriptions of an emergency. For this reason, an
  emergency notice is always shown above the chat, whatever is typed.
- One article per answer; complex or multi-problem questions need a veterinarian.
- The articles are general and must be reviewed by a veterinarian before real-world use.
