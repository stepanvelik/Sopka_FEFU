from __future__ import annotations

from datetime import date
from decimal import Decimal

from pydantic import BaseModel


class ParticipantSummaryEvent(BaseModel):
    event_id: int
    event_name: str
    event_level: str
    event_type_id: int | None
    event_type_name: str | None
    start_date: date
    end_date: date | None


class ParticipantSummaryCell(BaseModel):
    event_id: int
    hours: Decimal
    time_slots_count: int


class ParticipantSummaryRow(BaseModel):
    student_id: int
    full_name: str
    phone: int | None
    total_hours: Decimal
    events: list[ParticipantSummaryCell]


class ParticipantsSummaryReport(BaseModel):
    participant_count: int
    event_count: int
    events: list[ParticipantSummaryEvent]
    rows: list[ParticipantSummaryRow]


class StudentEventRow(BaseModel):
    event_id: int
    event_name: str
    event_date: date | None
    role: str
    hours: Decimal
    event_level: str
    event_type: str | None = None


class StudentSearchMatch(BaseModel):
    student_id: int
    full_name: str
    phone: int | None = None


class StudentEventsReport(BaseModel):
    student_id: int | None = None
    full_name: str = ""
    phone: int | None = None
    total_hours: Decimal = Decimal("0")
    total_events: int = 0
    events: list[StudentEventRow] = []
    matches: list[StudentSearchMatch] = []
