"""Loading the Markdown knowledge base (see knowledge/README.md for the format)."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

KNOWLEDGE_DIR = Path(__file__).resolve().parents[2] / "knowledge"
URGENCIES = ("routine", "see-vet", "emergency")
SPECIES = ("dog", "cat")


class KnowledgeError(ValueError):
    """An article is missing a field or has an invalid value."""


@dataclass(frozen=True)
class Section:
    heading: str
    text: str = ""
    items: tuple[str, ...] = ()

    def as_dict(self) -> dict:
        return {"heading": self.heading, "text": self.text, "items": list(self.items)}


@dataclass(frozen=True)
class Article:
    id: str
    title: str
    species: tuple[str, ...]
    category: str
    urgency: str
    keywords: tuple[str, ...]
    questions: tuple[str, ...]
    sources: tuple[str, ...]
    summary: str
    sections: tuple[Section, ...] = field(default=())

    def search_text(self) -> str:
        """Text used for retrieval. Title, keywords and questions are repeated to weigh more."""
        body = " ".join(s.text + " " + " ".join(s.items) for s in self.sections)
        return " ".join(
            [
                (self.title + " ") * 3,
                (" ".join(self.keywords) + " ") * 3,
                (" ".join(self.questions) + " ") * 2,
                self.summary,
                body,
            ]
        )

    def as_dict(self) -> dict:
        return {
            "id": self.id,
            "title": self.title,
            "category": self.category,
            "urgency": self.urgency,
            "species": list(self.species),
            "summary": self.summary,
            "sections": [s.as_dict() for s in self.sections],
            "sources": list(self.sources),
        }


def _split_list(value: str, separator: str) -> tuple[str, ...]:
    return tuple(part.strip() for part in value.split(separator) if part.strip())


def _clean(text: str) -> str:
    """Removes Markdown bold markers and joins wrapped lines."""
    return re.sub(r"\*\*(.+?)\*\*", r"\1", " ".join(text.split()))


def parse_article(text: str, name: str = "article") -> Article:
    match = re.match(r"^---\s*\n(.*?)\n---\s*\n(.*)$", text.strip() + "\n", re.S)
    if not match:
        raise KnowledgeError(f"{name}: missing front matter")
    meta: dict[str, str] = {}
    for line in match.group(1).splitlines():
        if ":" in line:
            key, value = line.split(":", 1)
            meta[key.strip()] = value.split(" #")[0].strip()

    for key in ("id", "title", "species", "category", "urgency", "keywords", "questions"):
        if not meta.get(key):
            raise KnowledgeError(f"{name}: missing '{key}'")
    species = _split_list(meta["species"], ",")
    if not species or any(s not in SPECIES for s in species):
        raise KnowledgeError(f"{name}: species must be dog and/or cat")
    if meta["urgency"] not in URGENCIES:
        raise KnowledgeError(f"{name}: urgency must be one of {URGENCIES}")

    summary = ""
    sections: list[Section] = []
    for block in re.split(r"^## ", match.group(2), flags=re.M)[1:]:
        heading, _, content = block.partition("\n")
        items = tuple(
            _clean(line[2:]) for line in content.splitlines() if line.strip().startswith("- ")
        )
        prose = _clean(
            " ".join(line for line in content.splitlines() if not line.strip().startswith("- "))
        )
        if heading.strip().lower() == "summary":
            summary = prose
        else:
            sections.append(Section(heading.strip(), prose, items))
    if not summary:
        raise KnowledgeError(f"{name}: missing '## Summary'")

    return Article(
        id=meta["id"],
        title=meta["title"],
        species=species,
        category=meta["category"],
        urgency=meta["urgency"],
        keywords=_split_list(meta["keywords"], ","),
        questions=_split_list(meta["questions"], "|"),
        sources=_split_list(meta.get("sources", ""), "|"),
        summary=summary,
        sections=tuple(sections),
    )


def load_knowledge(directory: Path = KNOWLEDGE_DIR) -> list[Article]:
    articles = [
        parse_article(path.read_text(encoding="utf-8"), path.name)
        for path in sorted(directory.glob("*.md"))
        if path.name.lower() != "readme.md"
    ]
    ids = [a.id for a in articles]
    duplicates = {i for i in ids if ids.count(i) > 1}
    if duplicates:
        raise KnowledgeError(f"duplicate article ids: {sorted(duplicates)}")
    return articles
