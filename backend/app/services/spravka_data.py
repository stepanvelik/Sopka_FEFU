"""Сбор данных справки из БД (студент + участие в мероприятии)."""

from __future__ import annotations

from datetime import date, time

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.event import Event
from app.models.event_participation import EventParticipation
from app.models.event_participation_time_slot import EventParticipationTimeSlot
from app.models.event_type import EventType
from app.models.student import Student
from app.services.fio_inflection import fio_to_dative

MONTH_GENITIVE = (
    "",
    "января",
    "февраля",
    "марта",
    "апреля",
    "мая",
    "июня",
    "июля",
    "августа",
    "сентября",
    "октября",
    "ноября",
    "декабря",
)

# Родительный падеж для фразы «при проведении …»
EVENT_TYPE_GENITIVE: dict[str, str] = {
    "Олимпиада": "олимпиады",
    "Конференция": "конференции",
    "Семинар": "семинара",
    "Мастер-класс": "мастер-класса",
    "Спортивное соревнование": "спортивного соревнования",
    "Выездное мероприятие": "выездного мероприятия",
    "Волонтёрский проект": "волонтёрского проекта",
    "Профориентация": "профориентации",
    "Культурное мероприятие": "культурного мероприятия",
    "Научная школа": "научной школы",
    "Хакатон": "хакатона",
    "Форум": "форума",
}

ROLE_GENITIVE: dict[str, str] = {
    "участник": "участника",
    "руководитель": "руководителя",
    "организатор": "организатора",
    "исполнитель": "исполнителя",
    "волонтер": "волонтёра",
    "волонтёр": "волонтёра",
}



def _student_full_name(student: Student) -> str:
    return " ".join(part for part in (student.last_name, student.first_name, student.middle_name) if part)


def _normalize_key(value: str) -> str:
    return value.strip().casefold().replace("ё", "е")


def event_type_to_genitive(event_type_name: str | None) -> str:
    if not event_type_name or not event_type_name.strip():
        return "мероприятия"

    raw = event_type_name.strip()
    mapped = EVENT_TYPE_GENITIVE.get(raw)
    if mapped:
        return mapped

    for key, value in EVENT_TYPE_GENITIVE.items():
        if _normalize_key(key) == _normalize_key(raw):
            return value

    name = raw.lower()
    if name.endswith("ия"):
        return name[:-2] + "ии"
    if name.endswith("а"):
        return name[:-1] + "ы"
    if name.endswith("й"):
        return name[:-1] + "я"
    return name


def role_to_genitive(role_name: str | None) -> str:

    role = (role_name or "Участник").strip() or "Участник"
    genitive = ROLE_GENITIVE.get(_normalize_key(role), role)
    if genitive and genitive[0].isupper():
        genitive = genitive[0].lower() + genitive[1:]
    return genitive


def _format_time(value: time | str | None) -> str:
    if value is None:
        return ""
    if isinstance(value, time):
        return value.strftime("%H:%M")
    text = str(value).strip()
    if len(text) >= 5 and text[2] == ":":
        return text[:5]
    return text


def _format_day_with_time(day: date, start_time: time | None, end_time: time | None) -> str:
    month_name = MONTH_GENITIVE[day.month] if 1 <= day.month <= 12 else ""
    day_part = f"{day.day} {month_name} {day.year} г."
    start_label = _format_time(start_time)
    end_label = _format_time(end_time)
    if start_label and end_label:
        return f"{day_part}, с {start_label} до {end_label}"
    return day_part


def _format_slots_line(slots: list[EventParticipationTimeSlot]) -> str:
    """Каждый слот участия — отдельная дата со своим временем."""
    if not slots:
        return "—"

    sorted_slots = sorted(
        slots,
        key=lambda slot: (slot.participation_date, slot.start_time or time.min),
    )
    parts = [
        _format_day_with_time(slot.participation_date, slot.start_time, slot.end_time)
        for slot in sorted_slots
    ]
    return "; ".join(parts)


def _format_event_schedule_line(event: Event) -> str | None:
    """Расписание мероприятия по дням (если у студента нет своих слотов)."""
    schedule = event.event_daily_schedule or []
    rows: list[tuple[date, time | None, time | None]] = []

    for row in schedule:
        if not isinstance(row, dict):
            continue
        raw_date = row.get("date")
        if not raw_date:
            continue
        if isinstance(raw_date, date):
            day = raw_date
        else:
            day = date.fromisoformat(str(raw_date)[:10])

        start_time = None
        end_time = None
        start_raw = row.get("start_time")
        end_raw = row.get("end_time")
        if start_raw:
            start_time = time.fromisoformat(str(start_raw)[:8])
        if end_raw:
            end_time = time.fromisoformat(str(end_raw)[:8])

        rows.append((day, start_time, end_time))

    if not rows:
        return None

    rows.sort(key=lambda item: item[0])
    return "; ".join(_format_day_with_time(day, start, end) for day, start, end in rows)


def _format_dates_line(dates: list[date], start_time: time | None, end_time: time | None) -> str:
    """Один интервал времени на все даты (fallback, если нет посуточного расписания)."""
    if not dates:
        return "—"

    unique_dates = sorted(set(dates))
    if len(unique_dates) == 1:
        return _format_day_with_time(unique_dates[0], start_time, end_time)

    by_month: dict[tuple[int, int], list[int]] = {}
    for item in unique_dates:
        key = (item.year, item.month)
        by_month.setdefault(key, []).append(item.day)

    parts: list[str] = []
    for (year, month), days in sorted(by_month.items()):
        days_sorted = sorted(set(days))
        month_name = MONTH_GENITIVE[month] if 1 <= month <= 12 else ""
        if len(days_sorted) == 1:
            parts.append(f"{days_sorted[0]} {month_name} {year} г.")
            continue
        if days_sorted == list(range(days_sorted[0], days_sorted[-1] + 1)):
            parts.append(f"{days_sorted[0]}-{days_sorted[-1]} {month_name}")
        else:
            day_chunks = ", ".join(str(day) for day in days_sorted)
            parts.append(f"{day_chunks} {month_name}")

    dates_text = ", ".join(parts)
    start_label = _format_time(start_time)
    end_label = _format_time(end_time)
    if start_label and end_label:
        return f"{dates_text}, с {start_label} до {end_label}"
    return dates_text


def _filter_slots(
    slots: list[EventParticipationTimeSlot],
    *,
    date_from: date | None,
    date_to: date | None,
) -> list[EventParticipationTimeSlot]:
    filtered: list[EventParticipationTimeSlot] = []
    for slot in slots:
        if date_from and slot.participation_date < date_from:
            continue
        if date_to and slot.participation_date > date_to:
            continue
        filtered.append(slot)
    return filtered


def _dates_from_event(event: Event) -> tuple[list[date], time | None, time | None]:
    schedule = event.event_daily_schedule or []
    dates: list[date] = []
    starts: list[time] = []
    ends: list[time] = []

    for row in schedule:
        if not isinstance(row, dict):
            continue
        raw_date = row.get("date")
        if not raw_date:
            continue
        if isinstance(raw_date, date):
            day = raw_date
        else:
            day = date.fromisoformat(str(raw_date)[:10])
        dates.append(day)

        start_raw = row.get("start_time")
        end_raw = row.get("end_time")
        if start_raw:
            starts.append(time.fromisoformat(str(start_raw)[:8]))
        if end_raw:
            ends.append(time.fromisoformat(str(end_raw)[:8]))

    if dates:
        return dates, min(starts) if starts else event.start_time, max(ends) if ends else event.end_time

    end = event.end_date or event.start_date
    cur = event.start_date
    span: list[date] = []
    while cur <= end:
        span.append(cur)
        cur = date.fromordinal(cur.toordinal() + 1)
    return span, event.start_time, event.end_time


async def build_spravka_payload(
    session: AsyncSession,
    *,
    student_id: int,
    event_id: int,
    date_from: date | None = None,
    date_to: date | None = None,
) -> dict[str, str]:
    student = await session.get(Student, student_id)
    if student is None:
        raise HTTPException(status_code=404, detail="Студент не найден.")

    stmt = (
        select(EventParticipation)
        .options(selectinload(EventParticipation.time_slots))
        .where(
            EventParticipation.student_id == student_id,
            EventParticipation.event_id == event_id,
        )
        .limit(1)
    )
    participation_result = await session.execute(stmt)
    participation = participation_result.scalar_one_or_none()
    if participation is None:
        raise HTTPException(status_code=404, detail="Участие студента в выбранном мероприятии не найдено.")

    event_stmt = (
        select(Event, EventType.event_type_name)
        .outerjoin(EventType, Event.event_type_id == EventType.event_type_id)
        .where(Event.event_id == event_id)
    )
    event_result = await session.execute(event_stmt)
    event_row = event_result.one_or_none()
    if event_row is None:
        raise HTTPException(status_code=404, detail="Мероприятие не найдено.")
    event, event_type_name = event_row

    slots = _filter_slots(list(participation.time_slots), date_from=date_from, date_to=date_to)
    if slots:
        dates_line = _format_slots_line(slots)
    else:
        schedule_line = _format_event_schedule_line(event)
        if schedule_line:
            dates_line = schedule_line
        else:
            event_dates, start_time, end_time = _dates_from_event(event)
            if date_from or date_to:
                event_dates = [
                    day
                    for day in event_dates
                    if (not date_from or day >= date_from) and (not date_to or day <= date_to)
                ]
            dates_line = _format_dates_line(event_dates, start_time, end_time)

    fio_nominative = _student_full_name(student)

    return {
        "fio": fio_to_dative(student.last_name, student.first_name, student.middle_name),
        "fio_nominative": fio_nominative,
        "group": student.study_group,
        "dates": dates_line,
        "event_type": event_type_to_genitive(event_type_name),
        "event_name": event.event_name,
        "role": role_to_genitive(participation.role_name),
    }
