"""Pure text helpers. No torch here, so they are easy to unit test."""
from __future__ import annotations

import re
import unicodedata

SENTENCE_END = (".", "?", "!")
_CONTROL = re.compile(r"[\x00-\x08\x0b-\x1f\x7f-\x9f​-‏‪-‮⁦-⁩]")
_SPACES = re.compile(r"[ \t\r\n]+")


def clean_prompt(raw: str) -> str:
    """Strip control and bidi characters, normalise unicode and whitespace."""
    text = unicodedata.normalize("NFKC", raw)
    text = _CONTROL.sub("", text)
    ends_with_space = text[-1:].isspace() if text else False
    text = _SPACES.sub(" ", text).strip()
    return text + " " if text and ends_with_space else text


def split_fragment(prompt: str) -> tuple[str, str]:
    """Return (context, fragment). Fragment is the unfinished last word, if any."""
    if not prompt or prompt[-1].isspace() or prompt[-1] in ",.?!;:":
        return prompt.strip(), ""
    head, _, tail = prompt.rpartition(" ")
    return head.strip(), tail


def is_word_token(token: str) -> bool:
    """A usable suggestion has at least one letter and no markers or spaces."""
    token = token.strip()
    if not token or token.startswith("[") or token.startswith("<"):
        return False
    if token.startswith("##"):
        return False
    return any(ch.isalpha() for ch in token) and " " not in token


def cut_after_sentences(text: str, sentences: int) -> str:
    """Keep text up to and including the Nth sentence end, if reached."""
    seen = 0
    for index, ch in enumerate(text):
        if ch in SENTENCE_END:
            seen += 1
            if seen >= sentences:
                return text[: index + 1]
    return text


def join_text(prompt: str, continuation: str) -> str:
    prompt = prompt.rstrip()
    continuation = continuation.strip()
    if not continuation:
        return prompt
    if continuation[0] in ",.?!;:":
        return prompt + continuation
    return f"{prompt} {continuation}"


def contains_blocked(text: str, blocklist: tuple[str, ...]) -> bool:
    if not blocklist:
        return False
    words = set(re.findall(r"[\w']+", text.lower()))
    return any(w in words for w in blocklist)
