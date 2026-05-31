"""Склонение ФИО студента (дательный падеж для справки «Дана, …»)."""

from __future__ import annotations

from functools import lru_cache

import pymorphy3


@lru_cache(maxsize=1)
def _morph() -> pymorphy3.MorphAnalyzer:
    return pymorphy3.MorphAnalyzer()


def _detect_gender(middle_name: str | None, first_name: str | None = None) -> str:
    if middle_name:
        middle = middle_name.strip().casefold().replace("ё", "е")
        if middle.endswith(("овна", "евна", "ична", "инна")):
            return "female"
        if middle.endswith(("ович", "евич", "ич")):
            return "male"
    if first_name:
        first = first_name.strip().casefold().replace("ё", "е")
        if first.endswith(("а", "я", "ь")) and first not in ("никита", "илья", "фома", "кузьма", "савва"):
            return "female"
    return "male"


def _preserve_case(source: str, inflected: str) -> str:
    if not source or not inflected:
        return inflected
    if source.isupper():
        return inflected.upper()
    if source[0].isupper():
        return inflected[:1].upper() + inflected[1:]
    return inflected


def _inflect_word(word: str, gender: str) -> str:
    grammemes = {"datv"}
    if gender == "female":
        grammemes.add("femn")
    else:
        grammemes.add("masc")

    analyzer = _morph()
    for parse in analyzer.parse(word):
        inflected = parse.inflect(grammemes)
        if inflected is not None:
            return _preserve_case(word, inflected.word)

    return word


def fio_to_dative(last_name: str, first_name: str, middle_name: str | None = None) -> str:
    """Фамилия Имя Отчество → дательный падеж (Иванов Илья Иванович → Иванову Илье Ивановичу)."""
    gender = _detect_gender(middle_name, first_name)
    parts: list[str] = []

    last = (last_name or "").strip()
    first = (first_name or "").strip()
    middle = (middle_name or "").strip()

    if last:
        parts.append(_inflect_word(last, gender))
    if first:
        parts.append(_inflect_word(first, gender))
    if middle:
        parts.append(_inflect_word(middle, gender))

    return " ".join(parts)
