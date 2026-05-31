from datetime import date, datetime, time
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class EventParticipationTimeSlotCreate(BaseModel):
    participation_date: date
    start_time: time
    end_time: time
    participation_hours: Decimal | None = Field(None, gt=0, le=24)
    notes: str | None = None


class EventParticipationTimeSlotRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    participation_time_slot_id: int
    participation_id: int
    participation_date: date
    start_time: time
    end_time: time
    participation_hours: Decimal
    notes: str | None
    created_at: datetime


class EventParticipationCreate(BaseModel):
    student_id: int
    role_name: str = Field(..., min_length=1, max_length=100)
    participation_status: str | None = Field(None, max_length=50)
    notes: str | None = None
    time_slots: list[EventParticipationTimeSlotCreate] = Field(default_factory=list)


class EventParticipationUpdate(BaseModel):
    role_name: str | None = Field(None, min_length=1, max_length=100)
    participation_status: str | None = Field(None, max_length=50)
    notes: str | None = None
    time_slots: list[EventParticipationTimeSlotCreate] | None = None


class EventParticipationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    participation_id: int
    student_id: int
    event_id: int
    role_name: str
    participation_status: str | None
    notes: str | None
    created_at: datetime
    updated_at: datetime
    time_slots: list[EventParticipationTimeSlotRead] = Field(default_factory=list)
