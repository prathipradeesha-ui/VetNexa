"""Builds the assistant's reply: safety triage first, then retrieval, then a cautious answer.

Every reply has the same shape so the API can store it and the web app can render it:

    kind        answer | emergency | redirect | fallback | smalltalk
    text        plain-text version (stored in chat history, read by screen readers)
    emergency   { reason, steps } for emergencies, otherwise null
    article     the matched knowledge-base article, or null
    related     up to two other relevant articles, offered as follow-up questions
    suggestions example questions the owner can tap
    actions     links into VetNexa, e.g. emergency clinics or booking a consultation
    score       retrieval score of the article (for evaluation), or null
"""

from __future__ import annotations

from .knowledge import Article, load_knowledge
from .retrieval import KnowledgeIndex, Match
from .safety import normalise, triage

#: Below this retrieval score the assistant says it does not know instead of guessing.
MIN_SCORE = 0.10
#: Related articles must reach this share of the best score to be offered.
RELATED_SHARE = 0.75

DISCLAIMER = (
    "General information only, not veterinary advice. It cannot replace an examination by a "
    "veterinarian."
)

EMERGENCY_CLINICS = {"label": "Find an emergency clinic", "href": "/clinics?emergency=true"}
FIND_CLINIC = {"label": "Find a clinic", "href": "/clinics"}
BOOK = {"label": "Book a consultation", "href": "/dashboard/consultations/new"}
WOUND_CHECK = {"label": "Open Wound check", "href": "/dashboard/assessments/new"}
RESCUE = {"label": "Report an animal", "href": "/dashboard/rescue/new"}
ADOPT = {"label": "Browse animals to adopt", "href": "/adopt"}

EMERGENCY_STEPS = (
    "Contact or go to a veterinary clinic now. Call ahead if you can so they are ready.",
    "Keep your pet calm, warm (or cool if overheated) and as still as possible on the way.",
    "Do not give food, drink or any medicine unless a veterinarian tells you to.",
    "Bring any packaging, plant or substance your pet may have eaten.",
)

STARTER_QUESTIONS = (
    "When should my puppy be vaccinated?",
    "Which foods are dangerous for cats?",
    "How often should I deworm my dog?",
    "My dog is vomiting, what should I do?",
)


class Assistant:
    def __init__(self, articles: list[Article] | None = None):
        self.articles = articles if articles is not None else load_knowledge()
        self.index = KnowledgeIndex(self.articles)
        self.by_id = {a.id: a for a in self.articles}

    # ── helpers ──

    def _related(self, matches: list[Match], best: Match) -> list[dict]:
        return [
            {"id": m.article.id, "title": m.article.title, "question": m.article.questions[0]}
            for m in matches
            if m.article.id != best.article.id and m.score >= best.score * RELATED_SHARE
        ][:2]

    @staticmethod
    def _actions_for(article: Article) -> list[dict]:
        if article.urgency == "emergency":
            return [EMERGENCY_CLINICS, BOOK]
        if article.id == "wound-first-aid":
            return [WOUND_CHECK, FIND_CLINIC]
        if article.id == "injured-stray-animal":
            return [RESCUE, EMERGENCY_CLINICS]
        if article.id == "adopting-a-pet":
            return [ADOPT]
        if article.urgency == "see-vet":
            return [BOOK, FIND_CLINIC]
        return [FIND_CLINIC]

    @staticmethod
    def _reply(kind: str, text: str, **extra) -> dict:
        return {
            "kind": kind,
            "text": text,
            "emergency": None,
            "article": None,
            "related": [],
            "suggestions": [],
            "actions": [],
            "score": None,
            "disclaimer": DISCLAIMER,
            **extra,
        }

    def _best(self, message: str) -> tuple[Match | None, list[Match]]:
        matches = self.index.search(message, limit=4)
        best = matches[0] if matches and matches[0].score >= MIN_SCORE else None
        return best, matches

    # ── main entry point ──

    def reply(self, message: str) -> dict:
        text = normalise(message)
        special = triage(text)

        if special and special.kind == "about":
            return self._reply(
                "smalltalk",
                "I answer general questions about caring for dogs and cats from a written "
                "pet-care knowledge base: vaccinations, parasites, feeding, common illnesses, "
                "first aid and how to use VetNexa. I can't examine your pet or diagnose illness, "
                "and I always point you to a vet when something sounds urgent.",
                suggestions=list(STARTER_QUESTIONS),
            )
        if special and special.kind == "greeting":
            return self._reply(
                "smalltalk",
                "Hello! I can answer general questions about caring for dogs and cats, such as "
                "vaccinations, parasites, feeding, common illnesses and first aid.",
                suggestions=list(STARTER_QUESTIONS),
            )
        if special and special.kind == "thanks":
            return self._reply(
                "smalltalk",
                "You're welcome. Look after yourself and your pet, and contact a vet if you are "
                "ever unsure.",
                suggestions=list(STARTER_QUESTIONS[:2]),
            )

        best, matches = self._best(text)

        if special and special.kind == "emergency":
            # Attach the matching emergency article (e.g. heatstroke first aid) when there is one.
            article = best.article if best and best.article.urgency == "emergency" else None
            return self._reply(
                "emergency",
                f"This sounds like it could be an emergency ({special.reason}). Please contact a "
                "veterinarian immediately.",
                emergency={"reason": special.reason, "steps": list(EMERGENCY_STEPS)},
                article=article.as_dict() if article else None,
                actions=[EMERGENCY_CLINICS],
                score=round(best.score, 4) if article and best else None,
            )

        if special and special.kind == "medication":
            return self._reply(
                "redirect",
                "I can't recommend medicines or doses. Many human medicines, including "
                "paracetamol and ibuprofen, are dangerous for pets, and a safe dose depends on "
                "the animal's weight, age and health. Please ask a veterinarian.",
                article=self.by_id["human-medicines"].as_dict()
                if "human-medicines" in self.by_id
                else None,
                actions=[BOOK, FIND_CLINIC],
            )

        if special and special.kind == "human_bite":
            return self._reply(
                "redirect",
                "If a person has been bitten or scratched, wash the wound straight away with soap "
                "and plenty of running water for about 15 minutes, then see a doctor or hospital "
                "today. In areas with rabies this is urgent, even for small wounds.",
                article=self.by_id["rabies"].as_dict() if "rabies" in self.by_id else None,
                actions=[RESCUE],
            )

        if special and special.kind == "human_health":
            return self._reply(
                "redirect",
                "I can only help with questions about dogs and cats. For your own health or a "
                "family member's, please speak to a doctor or pharmacist.",
                suggestions=list(STARTER_QUESTIONS[:2]),
            )

        if special and special.kind == "other_species":
            return self._reply(
                "redirect",
                "I only have information about dogs and cats. For other animals, please ask a "
                "veterinarian who treats that species.",
                actions=[FIND_CLINIC],
            )

        if best is None:
            return self._reply(
                "fallback",
                "Sorry, I don't have reliable information about that. Try asking in a different "
                "way, or ask a veterinarian. If your pet seems unwell, it is always safest to "
                "contact a clinic.",
                suggestions=list(STARTER_QUESTIONS),
                actions=[BOOK, FIND_CLINIC],
            )

        article = best.article
        return self._reply(
            "answer",
            f"{article.title}: {article.summary}",
            article=article.as_dict(),
            related=self._related(matches, best),
            actions=self._actions_for(article),
            score=round(best.score, 4),
        )
