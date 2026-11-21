"""Safety triage that runs BEFORE retrieval.

Some messages must never get an ordinary article as the answer:

* **Emergencies** (breathing problems, collapse, poisoning, heavy bleeding and so on) get an
  immediate "go to a vet now" response with first steps and a link to emergency clinics.
* **Medicine and dose questions** are redirected: only a vet can prescribe for an animal.
* **Human health questions** and **other species** are outside what the assistant covers.

The patterns deliberately err on the side of caution: treating a non-emergency as urgent is
much less harmful than the opposite.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

_EAT = r"(ate|eaten|eats|eat|swallowed|licked|chewed|got into|drank|drunk|consumed)"
_TOXINS = (
    r"(poison|rat bait|rat ?kill|rodenticide|chocolate|grapes?|raisins?|sultanas?|xylitol|"
    r"antifreeze|bleach|insecticide|pesticide|weed ?killer|medicine|tablets?|pills?|"
    r"paracetamol|panadol|ibuprofen|brufen|aspirin|lil(y|ies)|onions?|garlic|chemicals?)"
)

#: (reason shown to the owner, pattern). Checked in order; the first match wins.
EMERGENCY_RULES: tuple[tuple[str, str], ...] = (
    (
        "breathing difficulty",
        r"(not|isn'?t|can'?t|cannot|stopped|struggl\w* to|trouble|difficult\w*|hard to|unable to)"
        r"\s+(breath|breathing)|gasping|choking|blue (gums|tongue)|open[- ]mouth(ed)? breath|"
        r"breath\w* (with|through) (an |its |his |her |the )?open mouth",
    ),
    (
        "collapse or unconsciousness",
        r"collaps|unconscious|unresponsive|won'?t wake|not waking|passed out|fainted|"
        r"can'?t (stand|get up)|cannot (stand|get up)",
    ),
    ("a seizure", r"seiz|convuls|(having|had|has) (a )?fits?\b|fitting\b"),
    (
        "possible poisoning",
        rf"{_EAT}\b.{{0,40}}\b{_TOXINS}|{_TOXINS}.{{0,30}}\b{_EAT}\b|\bpoison(ed|ing)?\b",
    ),
    (
        "heavy bleeding",
        r"(heav\w*|a lot of|lots of|won'?t stop|wont stop|not stopping|spurting|pouring)\s+"
        r"(bleed\w*|blood)|bleed\w* (heavily|a lot|badly|won'?t stop|wont stop|non ?stop)|"
        r"(vomit\w*|throw\w* up|cough\w*) blood",
    ),
    (
        "a serious accident",
        r"hit by (a |the )?(car|vehicle|bike|motorbike|bus|lorry|truck|tuk|van)|run over|"
        r"fell from|fallen from",
    ),
    ("a snake bite", r"snake"),
    ("heatstroke", r"heat ?stroke|(left|locked|stuck) in (a|the) (hot )?car|overheat"),
    (
        "possible bloat (twisted stomach)",
        r"(swollen|bloated|distended|hard|tight) (belly|stomach|tummy|abdomen)|"
        r"retching|dry heav|trying to (vomit|throw up|be sick)",
    ),
    (
        "a possible urinary blockage",
        r"(can'?t|cannot|not able to|unable to|straining to|trying to) (pee|urinate|wee)|"
        r"straining in (the )?litter|no (pee|urine) (is )?coming|blocked (cat|bladder)",
    ),
    (
        "very pale gums",
        r"(pale|white|grey|gray) gums|gums (are|look|seem|turned|have gone) "
        r"(very )?(pale|white|grey|gray|blue)",
    ),
    ("a serious eye injury", r"eye(ball)? (popped|is out|came out|bulging|hanging)"),
    (
        "a difficult birth",
        r"(labou?r|giving birth|whelping|kittening).{0,40}(hours|stuck|no (puppy|kitten))|"
        r"(puppy|kitten) (is )?stuck",
    ),
)

_HUMAN_MEDS = r"paracetamol|panadol|acetaminophen|ibuprofen|brufen|naproxen|diclofenac|aspirin"
MEDICATION_PATTERN = re.compile(
    rf"\b(dose|dosage|dosing|mg|ml|milligrams?)\b|how (much|many) .{{0,30}}"
    rf"(medicine|tablets?|pills?|drops|{_HUMAN_MEDS})|"
    rf"\b(give|giving|use)\b .{{0,30}}\b({_HUMAN_MEDS}|painkiller|antibiotic|steroid)",
)
HUMAN_BITE_PATTERN = re.compile(r"\b(bit|bitten|scratched)\s+(me|my (son|daughter|child|kid))")
HUMAN_HEALTH_PATTERN = re.compile(
    r"\b(i|i'm|i am|me|myself|my (son|daughter|child|kid|baby|wife|husband|mother|father|mum|"
    r"mom|dad))\b.{0,40}\b(rash|fever|headache|pregnan\w*|cough\w*|sick|infection|symptoms?|"
    r"allerg\w*|pain)\b"
)
DOG_CAT_WORDS = re.compile(r"\b(dog|dogs|puppy|puppies|pup|cat|cats|kitten|kittens)\b")
PET_WORDS = re.compile(rf"{DOG_CAT_WORDS.pattern}|\b(pet|pets)\b")
OTHER_SPECIES = re.compile(
    r"\b(rabbit|bunny|bird|parrot|budgie|hamster|guinea pig|fish|turtle|tortoise|horse|cow|"
    r"goat|chicken|hen|ferret|mouse|rat)s?\b"
)
GREETING = re.compile(r"^(hi|hello|hey|hiya|good (morning|afternoon|evening)|ayubowan)\b[\s!.]*$")
ABOUT = re.compile(
    r"^(what can you (do|help with)|who are you|what are you|how do you work|help|help me|"
    r"what do you know)[\s?!.]*$"
)
THANKS = re.compile(r"^(thanks|thank you|thx|ok|okay|great|cool)\b.{0,20}$")


@dataclass(frozen=True)
class Triage:
    #: emergency, medication, human_bite, human_health, other_species, greeting, about or thanks
    kind: str
    reason: str = ""


def normalise(message: str) -> str:
    text = message.lower().replace("’", "'")
    return " ".join(text.split())


def triage(message: str) -> Triage | None:
    """Returns the special handling a message needs, or None for an ordinary question."""
    text = normalise(message)
    if GREETING.match(text):
        return Triage("greeting")
    if ABOUT.match(text):
        return Triage("about")
    if THANKS.match(text):
        return Triage("thanks")
    if HUMAN_BITE_PATTERN.search(text):
        return Triage("human_bite")
    for reason, pattern in EMERGENCY_RULES:
        if re.search(pattern, text):
            return Triage("emergency", reason)
    if MEDICATION_PATTERN.search(text):
        return Triage("medication")
    if HUMAN_HEALTH_PATTERN.search(text) and not PET_WORDS.search(text):
        return Triage("human_health")
    if OTHER_SPECIES.search(text) and not DOG_CAT_WORDS.search(text):
        return Triage("other_species")
    return None
