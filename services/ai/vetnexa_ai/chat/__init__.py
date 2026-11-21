"""Retrieval-based pet-care assistant: knowledge base, safety triage and answer building."""

from .assistant import Assistant
from .knowledge import Article, load_knowledge

__all__ = ["Article", "Assistant", "load_knowledge"]
