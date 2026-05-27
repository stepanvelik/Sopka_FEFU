from datetime import time
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api import commit_session
from app.database import get_session
from app.models.event import Event
from app.models.event_participation import EventParticipation
from app.models.event_participation_time_slot import EventParticipationTimeSlot
from app.schemas.event_participation import (
    EventParticipationCreate,
    EventParticipationRead,
    EventParticipationTimeSlotCreate,
    EventParticipationUpdate,
)


# Вложенные операции внутри мероприятия: /events/{event_id}/participants
nested = APIRouter(prefix="/events/{event_id}/participants", tags=["event-participation"])

# Корневые операции с участием по ID: /participants/{participation_id}
root = APIRouter(prefix="/participants", tags=["event-participation"])


async def _get_event_or_404(session: AsyncSession, event_id: int) -> Event:
    event = await session.get(Event, event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Мероприятие не найдено.")
    return event


def _calculate_participation_hours(start_time: time, end_time: time) -> Decimal:
    start_minutes = start_time.hour * 60 + start_time.minute + start_time.second / 60
    end_minutes = end_time.hour * 60 + end_time.minute + end_time.second / 60
    diff_minutes = end_minutes - start_minutes
    if diff_minutes <= 0:
        raise HTTPException(status_code=422, detail="Время окончания участия должно быть позже времени начала.")
    return (Decimal(str(diff_minutes)) / Decimal("60")).quantize(Decimal("0.01"))


def _slot_to_model(participation_id: int, slot: EventParticipationTimeSlotCreate) -> EventParticipationTimeSlot:
    return EventParticipationTimeSlot(
        participation_id=participation_id,
        participation_date=slot.participation_date,
        start_time=slot.start_time,
        end_time=slot.end_time,
        participation_hours=slot.participation_hours
        if slot.participation_hours is not None
        else _calculate_participation_hours(slot.start_time, slot.end_time),
        notes=slot.notes,
    )


async def _replace_time_slots(
    session: AsyncSession,
    participation_id: int,
    slots: list[EventParticipationTimeSlotCreate],
) -> None:
    next_slots = [_slot_to_model(participation_id, slot) for slot in slots]
    await session.execute(
        delete(EventParticipationTimeSlot).where(EventParticipationTimeSlot.participation_id == participation_id)
    )
    for slot in next_slots:
        session.add(slot)


async def _load_participation(session: AsyncSession, participation_id: int) -> EventParticipation:
    stmt = (
        select(EventParticipation)
        .options(selectinload(EventParticipation.time_slots))
        .where(EventParticipation.participation_id == participation_id)
    )
    result = await session.execute(stmt)
    participation = result.scalar_one_or_none()
    if participation is None:
        raise HTTPException(status_code=404, detail="Запись участия не найдена.")
    return participation


# эндпоинты связаны с конкретным мероприятием
@nested.post("", response_model=EventParticipationRead, status_code=201)
async def add_participant(
    event_id: int,
    body: EventParticipationCreate,
    session: AsyncSession = Depends(get_session),
) -> EventParticipation:
    await _get_event_or_404(session, event_id)

    participation = EventParticipation(
        event_id=event_id,
        **body.model_dump(exclude={"time_slots"}),
    )

    try:
        session.add(participation)
        await session.flush()

        for slot in body.time_slots:
            session.add(_slot_to_model(participation.participation_id, slot))

        await commit_session(session)
    except HTTPException:
        await session.rollback()
        raise
    except Exception as exc:
        await session.rollback()
        if hasattr(exc, "orig") and "uq_event_participation" in str(exc.orig).lower():
            raise HTTPException(
                status_code=409,
                detail="Этот студент уже добавлен в мероприятие.",
            ) from exc
        raise HTTPException(status_code=500, detail="Ошибка при добавлении участника.")

    return await _load_participation(session, participation.participation_id)


@nested.get("", response_model=list[EventParticipationRead])
async def list_participants(
    event_id: int,
    session: AsyncSession = Depends(get_session),
) -> list[EventParticipation]:
    await _get_event_or_404(session, event_id)

    stmt = (
        select(EventParticipation)
        .options(selectinload(EventParticipation.time_slots))
        .where(EventParticipation.event_id == event_id)
        .order_by(EventParticipation.participation_id)
    )
    result = await session.execute(stmt)
    return list(result.scalars().all())


@nested.patch("/{participation_id}", response_model=EventParticipationRead)
async def update_participation_in_event(
    event_id: int,
    participation_id: int,
    body: EventParticipationUpdate,
    session: AsyncSession = Depends(get_session),
) -> EventParticipation:
    await _get_event_or_404(session, event_id)

    participation = await session.get(EventParticipation, participation_id)
    if participation is None or participation.event_id != event_id:
        raise HTTPException(status_code=404, detail="Запись участия не найдена.")

    data = body.model_dump(exclude_unset=True, exclude={"time_slots"})
    has_time_slots = body.time_slots is not None
    if not data and not has_time_slots:
        return await _load_participation(session, participation_id)

    for key, value in data.items():
        setattr(participation, key, value)

    if has_time_slots:
        await _replace_time_slots(session, participation_id, body.time_slots or [])

    session.add(participation)
    await commit_session(session)
    return await _load_participation(session, participation_id)


@nested.delete("/{participation_id}", status_code=204)
async def delete_participation_from_event(
    event_id: int,
    participation_id: int,
    session: AsyncSession = Depends(get_session),
) -> None:
    await _get_event_or_404(session, event_id)

    participation = await session.get(EventParticipation, participation_id)
    if participation is None or participation.event_id != event_id:
        raise HTTPException(status_code=404, detail="Запись участия не найдена.")

    await session.delete(participation)
    await commit_session(session)
    return None


# --------------------------------------------------------------------------- #
# Корневые эндпоинты (работа с участием по его ID, без привязки к мероприятию)
# --------------------------------------------------------------------------- #

@root.get("/{participation_id}", response_model=EventParticipationRead)
async def get_participation(
    participation_id: int,
    session: AsyncSession = Depends(get_session),
) -> EventParticipation:
    return await _load_participation(session, participation_id)


@root.patch("/{participation_id}", response_model=EventParticipationRead)
async def update_participation(
    participation_id: int,
    body: EventParticipationUpdate,
    session: AsyncSession = Depends(get_session),
) -> EventParticipation:
    participation = await session.get(EventParticipation, participation_id)
    if participation is None:
        raise HTTPException(status_code=404, detail="Запись участия не найдена.")

    data = body.model_dump(exclude_unset=True, exclude={"time_slots"})
    has_time_slots = body.time_slots is not None
    if not data and not has_time_slots:
        return await _load_participation(session, participation_id)

    for key, value in data.items():
        setattr(participation, key, value)

    if has_time_slots:
        await _replace_time_slots(session, participation_id, body.time_slots or [])

    session.add(participation)
    await commit_session(session)
    return await _load_participation(session, participation_id)


@root.delete("/{participation_id}", status_code=204)
async def delete_participation(
    participation_id: int,
    session: AsyncSession = Depends(get_session),
) -> None:
    participation = await session.get(EventParticipation, participation_id)
    if participation is None:
        raise HTTPException(status_code=404, detail="Запись участия не найдена.")

    await session.delete(participation)
    await commit_session(session)
    return None


router = APIRouter()
router.include_router(nested)
router.include_router(root)
