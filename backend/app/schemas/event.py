from __future__ import annotations

from datetime import date, datetime, time
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class EventCreate(BaseModel):
    event_name: str = Field(..., max_length=500)
    event_level: str = Field(..., max_length=50)
    organizer_name: str | None = Field(None, max_length=255)
    organization_id: int | None = None

    start_date: date
    end_date: date | None = None
    start_time: time | None = None
    end_time: time | None = None

    participants_planned: int | None = Field(None, ge=0)
    duration_hours: Decimal | None = Field(None, ge=0)


class EventUpdate(BaseModel):
    event_name: str | None = Field(None, max_length=500)
    event_level: str | None = Field(None, max_length=50)
    organizer_name: str | None = Field(None, max_length=255)
    organization_id: int | None = None

    start_date: date | None = None
    end_date: date | None = None
    start_time: time | None = None
    end_time: time | None = None

    participants_planned: int | None = Field(None, ge=0)
    duration_hours: Decimal | None = Field(None, ge=0)


class EventRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    event_id: int
    event_name: str
    event_level: str
    organizer_name: str | None
    organization_id: int | None

    start_date: date
    end_date: date | None
    start_time: time | None
    end_time: time | None

    participants_planned: int | None
    duration_hours: Decimal | None

    created_at: datetime

