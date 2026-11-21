"""Tests for the pet-care assistant: knowledge base, safety triage, retrieval and replies."""

import pytest

from vetnexa_ai.chat import Assistant, load_knowledge
from vetnexa_ai.chat.knowledge import KnowledgeError, parse_article
from vetnexa_ai.chat.safety import triage


@pytest.fixture(scope="module")
def assistant():
    return Assistant()


# ── Knowledge base ──


def test_every_article_is_valid_and_complete():
    articles = load_knowledge()
    assert len(articles) >= 30
    for article in articles:
        assert article.summary, article.id
        assert article.questions, article.id
        assert article.sources, article.id
        assert article.sections, article.id


def test_emergency_articles_say_when_to_get_help():
    for article in load_knowledge():
        headings = [s.heading.lower() for s in article.sections]
        if article.urgency == "emergency" and article.category == "Emergencies":
            assert any(h.startswith("get help now") for h in headings), article.id


def test_invalid_article_is_rejected():
    with pytest.raises(KnowledgeError, match="species"):
        parse_article(
            "---\nid: x\ntitle: X\nspecies: rabbit\ncategory: C\nurgency: routine\n"
            "keywords: a\nquestions: q\n---\n## Summary\nText\n"
        )
    with pytest.raises(KnowledgeError, match="front matter"):
        parse_article("no front matter here")


def test_example_questions_find_their_own_article(assistant):
    """Self-retrieval: an article's own example questions should lead to it."""
    total = hits = 0
    for article in assistant.articles:
        for question in article.questions:
            total += 1
            hits += assistant.index.search(question, limit=1)[0].article.id == article.id
    assert hits / total >= 0.9, f"only {hits}/{total} example questions matched"


# ── Retrieval on new wording (not copied from the articles) ──

PARAPHRASES = [
    ("when does a puppy need its first injections", "dog-vaccinations"),
    ("does my indoor cat really need shots", "cat-vaccinations"),
    ("how often should worming tablets be given", "deworming"),
    ("best way to get a tick off my dog", "fleas-and-ticks"),
    ("my dog keeps vommiting", "vomiting-diarrhoea"),
    ("my cat has had runny poo since yesterday", "vomiting-diarrhoea"),
    ("my cat hasn't touched her food all day", "not-eating"),
    ("my dog's breath smells terrible", "dental-care"),
    ("my dog keeps scratching and has bald spots", "itchy-skin"),
    ("my dog keeps shaking his head and the ear smells", "ear-problems"),
    ("my cat's eye is red and weepy", "eye-problems"),
    ("my cat keeps sneezing", "cat-flu-kennel-cough"),
    ("what age should I get my female cat spayed", "neutering"),
    ("how much food does a labrador need", "feeding-and-weight"),
    ("my old dog is slowing down and stiff", "senior-pets"),
    ("my dog is limping on his back leg", "limping"),
    ("i found a kitten alone on the road", "injured-stray-animal"),
    ("how can I adopt a cat", "adopting-a-pet"),
    ("how do i book a vet appointment", "using-vetnexa"),
    ("how should I clean a small graze on my dog", "wound-first-aid"),
    ("how do i keep my dog cool in hot weather", "heatstroke"),
    ("can dogs have grapes", "toxic-foods"),
]


@pytest.mark.parametrize(("question", "expected"), PARAPHRASES)
def test_paraphrased_questions_find_the_right_article(assistant, question, expected):
    reply = assistant.reply(question)
    assert reply["kind"] == "answer", reply["text"]
    assert reply["article"]["id"] == expected


def test_species_in_the_question_is_respected(assistant):
    assert assistant.reply("vaccination schedule for my kitten")["article"]["id"] == (
        "cat-vaccinations"
    )
    assert assistant.reply("vaccination schedule for my puppy")["article"]["id"] == (
        "dog-vaccinations"
    )


# ── Safety triage ──

EMERGENCIES = [
    ("my dog ate a whole bar of chocolate", "possible poisoning"),
    ("I think my cat licked insecticide", "possible poisoning"),
    ("my puppy is not breathing properly", "breathing difficulty"),
    ("my cat is breathing with an open mouth", "breathing difficulty"),
    ("my dog collapsed in the garden", "collapse or unconsciousness"),
    ("my dog is having a seizure", "a seizure"),
    ("the cut on his leg won't stop bleeding", "heavy bleeding"),
    ("my dog was hit by a car", "a serious accident"),
    ("a snake bit my dog", "a snake bite"),
    ("my dog was left in a hot car", "heatstroke"),
    ("my dog has a swollen belly and keeps retching", "possible bloat (twisted stomach)"),
    ("my male cat can't pee", "a possible urinary blockage"),
    ("my dog's gums are white", "very pale gums"),
]


@pytest.mark.parametrize(("message", "reason"), EMERGENCIES)
def test_emergencies_are_recognised(assistant, message, reason):
    reply = assistant.reply(message)
    assert reply["kind"] == "emergency"
    assert reply["emergency"]["reason"] == reason
    assert reply["actions"][0]["href"] == "/clinics?emergency=true"
    assert reply["emergency"]["steps"]


def test_emergency_includes_first_aid_article_when_one_matches(assistant):
    reply = assistant.reply("my dog collapsed after a hot walk, I think it's heatstroke")
    assert reply["kind"] == "emergency"
    assert reply["article"]["id"] == "heatstroke"


@pytest.mark.parametrize(
    "message",
    [
        "how do I keep my dog cool",
        "my dog's breath smells bad",
        "my dog likes to chase cars",
        "can my dog eat cooked chicken",
        "my cat sleeps a lot in the afternoon",
        "what is a healthy weight for my cat",
    ],
)
def test_ordinary_questions_are_not_treated_as_emergencies(message):
    result = triage(message)
    assert result is None or result.kind != "emergency"


def test_medicine_doses_are_never_given(assistant):
    for message in ["can I give my dog paracetamol", "how many mg of ibuprofen for my cat"]:
        reply = assistant.reply(message)
        assert reply["kind"] == "redirect"
        assert "can't recommend medicines or doses" in reply["text"]


def test_bites_to_people_get_first_aid_and_doctor_advice(assistant):
    reply = assistant.reply("a stray dog bit me")
    assert reply["kind"] == "redirect"
    assert "soap" in reply["text"] and "doctor" in reply["text"]


def test_human_health_and_other_species_are_redirected(assistant):
    assert assistant.reply("I have a fever and headache")["kind"] == "redirect"
    assert assistant.reply("my rabbit has diarrhoea")["kind"] == "redirect"


@pytest.mark.parametrize(
    "message", ["what is the capital of france", "football score today", "bitcoin price"]
)
def test_off_topic_questions_get_an_honest_fallback(assistant, message):
    reply = assistant.reply(message)
    assert reply["kind"] == "fallback"
    assert reply["article"] is None
    assert reply["suggestions"]


def test_small_talk(assistant):
    assert assistant.reply("Hello!")["kind"] == "smalltalk"
    assert assistant.reply("what can you do?")["kind"] == "smalltalk"
    assert assistant.reply("thank you")["kind"] == "smalltalk"


def test_every_reply_has_the_same_shape_and_a_disclaimer(assistant):
    keys = {
        "kind",
        "text",
        "emergency",
        "article",
        "related",
        "suggestions",
        "actions",
        "score",
        "disclaimer",
    }
    for message in ["hi", "my dog ate chocolate", "how to brush cat teeth", "weather today"]:
        reply = assistant.reply(message)
        assert set(reply) == keys
        assert "not veterinary advice" in reply["disclaimer"]
