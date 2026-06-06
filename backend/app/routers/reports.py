from __future__ import annotations

import os
import shutil
import tempfile
import zipfile
from datetime import date
from decimal import Decimal
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy import and_, case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.background import BackgroundTask

from app.database import get_session
from app.models.event import Event
from app.models.event_participation import EventParticipation
from app.models.event_participation_time_slot import EventParticipationTimeSlot
from app.models.event_type import EventType
from app.models.student import Student
from app.schemas.reports import (
    ParticipantSummaryCell,
    ParticipantSummaryEvent,
    ParticipantSummaryRow,
    ParticipantsSummaryReport,
    StudentEventRow,
    StudentEventsReport,
    StudentSearchMatch,
)
from app.services.generate_bank_details_excel import (
    build_bank_details_rows,
    generate_bank_details_excel,
    make_bank_details_excel_filename,
)
from app.services.generate_rekvizity import generate_rekvizity, make_filename as make_rekvizity_filename
from app.services.generate_rekvizity import resolve_template_path as resolve_rekvizity_template_path
from app.services.generate_rso_application import (
    generate_rso_application,
    make_rso_filename,
    resolve_rso_template_path,
)
from app.services.generate_spravka import generate_spravka, make_filename, resolve_template_path
from app.services.rekvizity_data import build_rekvizity_payload
from app.services.rso_application_data import build_rso_application_payload
from app.services.spravka_data import build_spravka_payload
from app.services.student_lookup import find_student_by_phone, normalize_phone

router = APIRouter(prefix="/reports", tags=["reports"])


STUDENT_SEARCH_LIMIT = 30


def _student_full_name(last_name: str, first_name: str, middle_name: str | None) -> str:
    return " ".join(part for part in (last_name, first_name, middle_name) if part)


def _student_to_match(student: Student) -> StudentSearchMatch:
    return StudentSearchMatch(
        student_id=student.student_id,
        full_name=_student_full_name(student.last_name, student.first_name, student.middle_name),
        phone=student.phone,
    )


def _is_phone_search(search: str) -> bool:
    digits = "".join(char for char in search if char.isdigit())
    return len(digits) >= 10


async def _find_students_by_name(session: AsyncSession, search: str) -> list[Student]:
    query = search.strip()
    if not query:
        return []

    parts = [part for part in query.split() if part]
    if not parts:
        return []

    full_name_expr = func.trim(
        func.concat(
            Student.last_name,
            " ",
            Student.first_name,
            " ",
            func.coalesce(Student.middle_name, ""),
        )
    )
    conditions = [full_name_expr.ilike(f"%{query}%")]

    part_filters = []
    for part in parts:
        term = f"%{part}%"
        part_filters.append(
            or_(
                Student.last_name.ilike(term),
                Student.first_name.ilike(term),
                Student.middle_name.ilike(term),
            )
        )
    if part_filters:
        conditions.append(and_(*part_filters))

    stmt = (
        select(Student)
        .where(or_(*conditions))
        .order_by(Student.last_name, Student.first_name, Student.middle_name, Student.student_id)
        .limit(STUDENT_SEARCH_LIMIT)
    )
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def _resolve_student_for_search(
    session: AsyncSession,
    *,
    search: str | None,
    student_id: int | None,
) -> tuple[Student | None, list[StudentSearchMatch]]:
    if student_id is not None:
        student = await session.get(Student, student_id)
        if student is None:
            return None, []
        return student, []

    if not search or not search.strip():
        return None, []

    query = search.strip()
    if _is_phone_search(query):
        digits = "".join(char for char in query if char.isdigit())
        student = await find_student_by_phone(session, digits)
        return student, []

    students = await _find_students_by_name(session, query)
    if not students:
        return None, []
    if len(students) == 1:
        return students[0], []

    return None, [_student_to_match(item) for item in students]


async def _build_student_events_report(
    session: AsyncSession,
    student: Student,
    *,
    date_from: date | None,
    date_to: date | None,
    event_level: str | None,
    event_type_id: int | None,
) -> StudentEventsReport:
    slot_filters = []
    if date_from:
        slot_filters.append(EventParticipationTimeSlot.participation_date >= date_from)
    if date_to:
        slot_filters.append(EventParticipationTimeSlot.participation_date <= date_to)

    slot_hours = func.coalesce(EventParticipationTimeSlot.participation_hours, 0)
    if slot_filters:
        slot_match = and_(*slot_filters)
        hours_expr = case((slot_match, slot_hours), else_=0)
        event_date_expr = func.min(case((slot_match, EventParticipationTimeSlot.participation_date)))
    else:
        hours_expr = slot_hours
        event_date_expr = func.min(EventParticipationTimeSlot.participation_date)

    event_filters = [EventParticipation.student_id == student.student_id]
    if date_from:
        event_filters.append(func.coalesce(Event.end_date, Event.start_date) >= date_from)
    if date_to:
        event_filters.append(Event.start_date <= date_to)
    if event_level:
        event_filters.append(Event.event_level == event_level)
    if event_type_id:
        event_filters.append(Event.event_type_id == event_type_id)

    participation_stmt = (
        select(
            Event.event_id,
            Event.event_name,
            Event.start_date,
            Event.end_date,
            Event.event_level,
            EventType.event_type_name,
            EventParticipation.role_name,
            func.coalesce(func.sum(hours_expr), 0).label("hours"),
            event_date_expr.label("participation_date"),
        )
        .select_from(EventParticipation)
        .join(Event, Event.event_id == EventParticipation.event_id)
        .outerjoin(EventType, Event.event_type_id == EventType.event_type_id)
        .outerjoin(
            EventParticipationTimeSlot,
            EventParticipationTimeSlot.participation_id == EventParticipation.participation_id,
        )
        .where(*event_filters)
        .group_by(
            Event.event_id,
            Event.event_name,
            Event.start_date,
            Event.end_date,
            Event.event_level,
            EventType.event_type_name,
            EventParticipation.participation_id,
            EventParticipation.role_name,
        )
        .order_by(Event.start_date, Event.event_name, Event.event_id)
    )
    participation_result = await session.execute(participation_stmt)

    events: list[StudentEventRow] = []
    total_hours = Decimal("0")
    for row in participation_result.all():
        hours = Decimal(str(row.hours or 0))
        if hours <= 0 and slot_filters:
            continue

        total_hours += hours
        event_date = row.participation_date or row.start_date
        events.append(
            StudentEventRow(
                event_id=row.event_id,
                event_name=row.event_name,
                event_date=event_date,
                role=row.role_name,
                hours=hours,
                event_level=row.event_level,
                event_type=row.event_type_name,
            )
        )

    return StudentEventsReport(
        student_id=student.student_id,
        full_name=_student_full_name(student.last_name, student.first_name, student.middle_name),
        phone=student.phone,
        total_hours=total_hours,
        total_events=len(events),
        events=events,
        matches=[],
    )


@router.get("/participants-summary", response_model=ParticipantsSummaryReport)
async def get_participants_summary(
    session: AsyncSession = Depends(get_session),
    search: str | None = Query(None, max_length=200),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    event_level: str | None = Query(None, max_length=50),
    event_type_id: int | None = Query(None, ge=1),
    event_limit: int = Query(200, ge=1, le=500),
) -> ParticipantsSummaryReport:
    if date_from and date_to and date_from > date_to:
        raise HTTPException(status_code=422, detail="Дата начала периода не может быть позже даты окончания.")

    event_filters = []
    if search and search.strip():
        event_filters.append(Event.event_name.ilike(f"%{search.strip()}%"))
    if date_from:
        event_filters.append(func.coalesce(Event.end_date, Event.start_date) >= date_from)
    if date_to:
        event_filters.append(Event.start_date <= date_to)
    if event_level:
        event_filters.append(Event.event_level == event_level)
    if event_type_id:
        event_filters.append(Event.event_type_id == event_type_id)

    events_stmt = (
        select(Event, EventType.event_type_name)
        .outerjoin(EventType, Event.event_type_id == EventType.event_type_id)
        .where(*event_filters)
        .order_by(Event.start_date, Event.event_name, Event.event_id)
        .limit(event_limit)
    )
    event_result = await session.execute(events_stmt)

    events = [
        ParticipantSummaryEvent(
            event_id=event.event_id,
            event_name=event.event_name,
            event_level=event.event_level,
            event_type_id=event.event_type_id,
            event_type_name=event_type_name,
            start_date=event.start_date,
            end_date=event.end_date,
        )
        for event, event_type_name in event_result.all()
    ]

    if not events:
        return ParticipantsSummaryReport(participant_count=0, event_count=0, events=[], rows=[])

    event_ids = [event.event_id for event in events]

    slot_filters = []
    if date_from:
        slot_filters.append(EventParticipationTimeSlot.participation_date >= date_from)
    if date_to:
        slot_filters.append(EventParticipationTimeSlot.participation_date <= date_to)

    slot_hours = func.coalesce(EventParticipationTimeSlot.participation_hours, 0)
    if slot_filters:
        slot_match = and_(*slot_filters)
        hours_expr = case((slot_match, slot_hours), else_=0)
        slot_count_expr = func.count(case((slot_match, EventParticipationTimeSlot.participation_time_slot_id)))
    else:
        hours_expr = slot_hours
        slot_count_expr = func.count(EventParticipationTimeSlot.participation_time_slot_id)

    participation_stmt = (
        select(
            Student.student_id,
            Student.last_name,
            Student.first_name,
            Student.middle_name,
            Student.phone,
            EventParticipation.event_id,
            func.coalesce(func.sum(hours_expr), 0).label("hours"),
            slot_count_expr.label("time_slots_count"),
        )
        .select_from(EventParticipation)
        .join(Student, Student.student_id == EventParticipation.student_id)
        .outerjoin(
            EventParticipationTimeSlot,
            EventParticipationTimeSlot.participation_id == EventParticipation.participation_id,
        )
        .where(EventParticipation.event_id.in_(event_ids))
        .group_by(
            Student.student_id,
            Student.last_name,
            Student.first_name,
            Student.middle_name,
            Student.phone,
            EventParticipation.event_id,
        )
        .order_by(Student.last_name, Student.first_name, Student.middle_name, Student.student_id)
    )
    participation_result = await session.execute(participation_stmt)

    rows_by_student: dict[int, dict] = {}
    for row in participation_result.all():
        total_hours = Decimal(str(row.hours or 0))
        student_row = rows_by_student.setdefault(
            row.student_id,
            {
                "student_id": row.student_id,
                "full_name": _student_full_name(row.last_name, row.first_name, row.middle_name),
                "phone": row.phone,
                "total_hours": Decimal("0"),
                "cells": {},
            },
        )
        student_row["total_hours"] += total_hours
        student_row["cells"][row.event_id] = ParticipantSummaryCell(
            event_id=row.event_id,
            hours=total_hours,
            time_slots_count=int(row.time_slots_count or 0),
        )

    report_rows = []
    for row in rows_by_student.values():
        report_rows.append(
            ParticipantSummaryRow(
                student_id=row["student_id"],
                full_name=row["full_name"],
                phone=row["phone"],
                total_hours=row["total_hours"],
                events=[
                    row["cells"].get(
                        event.event_id,
                        ParticipantSummaryCell(
                            event_id=event.event_id,
                            hours=Decimal("0"),
                            time_slots_count=0,
                        ),
                    )
                    for event in events
                ],
            )
        )

    return ParticipantsSummaryReport(
        participant_count=len(report_rows),
        event_count=len(events),
        events=events,
        rows=report_rows,
    )


@router.get("/student-events", response_model=StudentEventsReport)
async def get_student_events(
    session: AsyncSession = Depends(get_session),
    search: str | None = Query(None, max_length=200),
    student_id: int | None = Query(None, ge=1),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    event_level: str | None = Query(None, max_length=50),
    event_type_id: int | None = Query(None, ge=1),
) -> StudentEventsReport:
    if date_from and date_to and date_from > date_to:
        raise HTTPException(status_code=422, detail="Дата начала периода не может быть позже даты окончания.")

    if not search and student_id is None:
        return StudentEventsReport()

    student, matches = await _resolve_student_for_search(
        session,
        search=search,
        student_id=student_id,
    )

    if matches:
        return StudentEventsReport(matches=matches)

    if student is None:
        return StudentEventsReport()

    return await _build_student_events_report(
        session,
        student,
        date_from=date_from,
        date_to=date_to,
        event_level=event_level,
        event_type_id=event_type_id,
    )


@router.get("/student-events/spravka")
async def download_student_spravka(
    session: AsyncSession = Depends(get_session),
    student_id: int = Query(..., ge=1),
    event_id: int = Query(..., ge=1),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
) -> FileResponse:
    if date_from and date_to and date_from > date_to:
        raise HTTPException(status_code=422, detail="Дата начала периода не может быть позже даты окончания.")

    payload = await build_spravka_payload(
        session,
        student_id=student_id,
        event_id=event_id,
        date_from=date_from,
        date_to=date_to,
    )

    try:
        template_path = resolve_template_path()
    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    fd, tmp_path = tempfile.mkstemp(suffix=".docx")
    os.close(fd)
    output_path = Path(tmp_path)

    try:
        generate_spravka(payload, template_path, output_path)
    except Exception as exc:
        output_path.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail="Не удалось сформировать справку.") from exc

    filename = make_filename(payload.get("fio_nominative") or payload["fio"])
    return FileResponse(
        path=output_path,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        filename=filename,
        background=BackgroundTask(lambda: output_path.unlink(missing_ok=True)),
    )


@router.get("/events/{event_id}/spravki.zip")
async def download_event_spravki_archive(
    event_id: int,
    session: AsyncSession = Depends(get_session),
    role_name: str | None = Query(None, max_length=100),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    student_ids: list[int] | None = Query(None),
) -> FileResponse:
    if date_from and date_to and date_from > date_to:
        raise HTTPException(status_code=422, detail="Дата начала периода не может быть позже даты окончания.")

    event = await session.get(Event, event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Мероприятие не найдено.")

    filters = [EventParticipation.event_id == event_id]
    if role_name and role_name.strip():
        filters.append(func.lower(EventParticipation.role_name) == role_name.strip().lower())
    if student_ids:
        filters.append(EventParticipation.student_id.in_(student_ids))
    if date_from or date_to:
        slot_filters = [EventParticipationTimeSlot.participation_id == EventParticipation.participation_id]
        if date_from:
            slot_filters.append(EventParticipationTimeSlot.participation_date >= date_from)
        if date_to:
            slot_filters.append(EventParticipationTimeSlot.participation_date <= date_to)
        matching_slot_exists = select(EventParticipationTimeSlot.participation_time_slot_id).where(*slot_filters).exists()
        any_slot_exists = (
            select(EventParticipationTimeSlot.participation_time_slot_id)
            .where(EventParticipationTimeSlot.participation_id == EventParticipation.participation_id)
            .exists()
        )
        filters.append(or_(matching_slot_exists, ~any_slot_exists))

    stmt = (
        select(EventParticipation, Student)
        .join(Student, Student.student_id == EventParticipation.student_id)
        .where(*filters)
        .order_by(Student.last_name, Student.first_name, Student.middle_name, Student.student_id)
    )
    result = await session.execute(stmt)
    rows = result.all()
    if not rows:
        raise HTTPException(status_code=404, detail="Нет участников для формирования справок.")

    try:
        template_path = resolve_template_path()
    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    tmp_dir = Path(tempfile.mkdtemp(prefix="spravki_"))
    zip_path = tmp_dir / "spravki.zip"

    try:
        with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            used_names: set[str] = set()
            for participation, student in rows:
                payload = await build_spravka_payload(
                    session,
                    student_id=participation.student_id,
                    event_id=event_id,
                    date_from=date_from,
                    date_to=date_to,
                )
                filename = make_filename(payload.get("fio_nominative") or _student_full_name(student.last_name, student.first_name, student.middle_name))
                if filename in used_names:
                    filename = f"{participation.participation_id}_{filename}"
                used_names.add(filename)

                docx_path = tmp_dir / filename
                generate_spravka(payload, template_path, docx_path)
                archive.write(docx_path, arcname=filename)
    except Exception as exc:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        raise HTTPException(status_code=500, detail="Не удалось сформировать архив справок.") from exc

    archive_name = f"Справки_{event.event_name[:80]}.zip".replace("/", "_").replace("\\", "_")
    return FileResponse(
        path=zip_path,
        media_type="application/zip",
        filename=archive_name,
        background=BackgroundTask(lambda: shutil.rmtree(tmp_dir, ignore_errors=True)),
    )


EMPLOYMENT_DOC_LABELS = {
    "file_1": "Заявление на вступление",
    "file_2": "Согласие ОПД",
    "file_3": "Реквизиты",
}
IMPLEMENTED_EMPLOYMENT_DOCS = {"file_1", "file_3"}


def _employment_documents_to_generate(file: str | None) -> set[str]:
    normalized = (file or "").strip()
    if not normalized:
        return set(IMPLEMENTED_EMPLOYMENT_DOCS)
    if normalized not in EMPLOYMENT_DOC_LABELS:
        raise HTTPException(status_code=422, detail="Некорректный тип документа.")
    return {normalized}


@router.get("/employment/documents.zip")
async def download_employment_documents_archive(
    session: AsyncSession = Depends(get_session),
    student_ids: list[int] = Query(..., min_length=1),
    file: str | None = Query(None),
) -> FileResponse:
    unique_ids = list(dict.fromkeys(student_ids))
    documents = _employment_documents_to_generate(file)

    unsupported = sorted(documents - IMPLEMENTED_EMPLOYMENT_DOCS)
    if unsupported:
        labels = ", ".join(EMPLOYMENT_DOC_LABELS[item] for item in unsupported)
        raise HTTPException(
            status_code=501,
            detail=f"Формирование документов «{labels}» пока не реализовано.",
        )

    templates: dict[str, Path] = {}
    try:
        if "file_1" in documents:
            templates["file_1"] = resolve_rso_template_path()
        if "file_3" in documents:
            templates["file_3"] = resolve_rekvizity_template_path()
    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    tmp_dir = Path(tempfile.mkdtemp(prefix="employment_docs_"))
    zip_path = tmp_dir / "employment_documents.zip"

    try:
        with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            used_names: set[str] = set()
            for student_id in unique_ids:
                if "file_1" in documents:
                    rso_payload = await build_rso_application_payload(session, student_id=student_id)
                    filename = make_rso_filename(rso_payload["full_name"])
                    if filename in used_names:
                        filename = f"{student_id}_{filename}"
                    used_names.add(filename)

                    docx_path = tmp_dir / filename
                    generate_rso_application(rso_payload, templates["file_1"], docx_path)
                    archive.write(docx_path, arcname=filename)

                if "file_3" in documents:
                    rekvizity_payload = await build_rekvizity_payload(session, student_id=student_id)
                    filename = make_rekvizity_filename(rekvizity_payload["fio"])
                    if filename in used_names:
                        filename = f"{student_id}_{filename}"
                    used_names.add(filename)

                    docx_path = tmp_dir / filename
                    generate_rekvizity(rekvizity_payload, templates["file_3"], docx_path)
                    archive.write(docx_path, arcname=filename)
    except HTTPException:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        raise
    except Exception as exc:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        raise HTTPException(status_code=500, detail="Не удалось сформировать архив документов.") from exc

    archive_name = "Документы_на_трудоустройство.zip"
    return FileResponse(
        path=zip_path,
        media_type="application/zip",
        filename=archive_name,
        background=BackgroundTask(lambda: shutil.rmtree(tmp_dir, ignore_errors=True)),
    )


@router.get("/employment/bank-details.xlsx")
async def download_employment_bank_details_excel(
    session: AsyncSession = Depends(get_session),
    student_ids: list[int] = Query(..., min_length=1),
) -> FileResponse:
    rows = await build_bank_details_rows(session, student_ids)

    fd, tmp_path = tempfile.mkstemp(suffix=".xlsx")
    os.close(fd)
    output_path = Path(tmp_path)

    try:
        generate_bank_details_excel(rows, output_path)
    except Exception as exc:
        output_path.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail="Не удалось сформировать Excel файл с банковскими реквизитами.") from exc

    return FileResponse(
        path=output_path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=make_bank_details_excel_filename(),
        background=BackgroundTask(lambda: output_path.unlink(missing_ok=True)),
    )
