"""Finding the article that best answers a question.

Two TF-IDF representations are combined:

* **words** (unigrams and bigrams, English stop words removed) match the meaning of a question;
* **character n-grams** (3–5 letters within words) tolerate spelling mistakes and word forms,
  e.g. "vomitting", "vaccinate" / "vaccination", which are common in typed questions.

The score is the average of the two cosine similarities. If the question names a species
("my cat"), articles that do not apply to that species are down-weighted.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from .knowledge import Article

_DOG = re.compile(r"\b(dog|dogs|puppy|puppies|pup|pups)\b")
_CAT = re.compile(r"\b(cat|cats|kitten|kittens|kitty)\b")

#: Penalty for an article written for another species than the one asked about.
SPECIES_PENALTY = 0.5


@dataclass(frozen=True)
class Match:
    article: Article
    score: float


def detect_species(text: str) -> str | None:
    dog, cat = bool(_DOG.search(text)), bool(_CAT.search(text))
    if dog == cat:
        return None  # neither, or both
    return "dog" if dog else "cat"


class KnowledgeIndex:
    def __init__(self, articles: list[Article]):
        if not articles:
            raise ValueError("The knowledge base is empty")
        self.articles = articles
        corpus = [a.search_text().lower() for a in articles]
        self.words = TfidfVectorizer(
            stop_words="english", ngram_range=(1, 2), sublinear_tf=True, strip_accents="unicode"
        )
        self.chars = TfidfVectorizer(
            analyzer="char_wb", ngram_range=(3, 5), sublinear_tf=True, strip_accents="unicode"
        )
        self.word_matrix = self.words.fit_transform(corpus)
        self.char_matrix = self.chars.fit_transform(corpus)

    def search(self, query: str, limit: int = 3) -> list[Match]:
        text = query.lower()
        word_scores = cosine_similarity(self.words.transform([text]), self.word_matrix)[0]
        char_scores = cosine_similarity(self.chars.transform([text]), self.char_matrix)[0]
        scores = (word_scores + char_scores) / 2

        species = detect_species(text)
        if species:
            penalty = np.array(
                [1.0 if species in a.species else SPECIES_PENALTY for a in self.articles]
            )
            scores = scores * penalty

        order = np.argsort(-scores)[:limit]
        return [Match(self.articles[i], float(scores[i])) for i in order]
