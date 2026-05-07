from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import commit_session
from app.database import get_session
from app.models.event import Event
from app.schemas.event import EventCreate, EventRead, EventUpdate

router = APIRouter(prefix="/events", tags=["events"])


@router.post("", response_model=EventRead, status_code=201)
async def create_event(body: EventCreate, session: AsyncSession = Depends(get_session)) -> Event:
    event = Event(**body.model_dump())
    session.add(event)
    await commit_session(session)
    await session.refresh(event)
    return event


@router.get("", response_model=list[EventRead])
async def list_events(
    session: AsyncSession = Depends(get_session),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
) -> list[Event]:
    stmt = select(Event).order_by(Event.event_id.desc()).offset(skip).limit(limit)
    result = await session.execute(stmt)
    return list(result.scalars().all())


@router.get("/{event_id}", response_model=EventRead)
async def get_event(event_id: int, session: AsyncSession = Depends(get_session)) -> Event:
    event = await session.get(Event, event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Мероприятие не найдено.")
    return event


@router.patch("/{event_id}", response_model=EventRead)
async def update_event(event_id: int, body: EventUpdate, session: AsyncSession = Depends(get_session)) -> Event:
    event = await session.get(Event, event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Мероприятие не найдено.")
    data = body.model_dump(exclude_unset=True)
    if not data:
        return event
    for key, value in data.items():
        setattr(event, key, value)
    session.add(event)
    await commit_session(session)
    await session.refresh(event)
    return event


@router.delete("/{event_id}", status_code=204)
async def delete_event(event_id: int, session: AsyncSession = Depends(get_session)) -> None:
    event = await session.get(Event, event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Мероприятие не найдено.")
    await session.delete(event)
    await commit_session(session)
    return None

