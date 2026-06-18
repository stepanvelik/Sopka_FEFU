from datetime import datetime

from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import commit_session
from app.database import get_session
from app.models.student import Student
from app.schemas.student import (
    StudentCreate,
    StudentFindOrCreate,
    StudentFindOrCreateResponse,
    StudentRead,
    StudentUpdate,
)
from app.services.excel_import import ExcelImportService, ImportMode
from app.services.student_lookup import find_or_create_student

router = APIRouter(prefix="/students", tags=["students"])


@router.post("/find-or-create", response_model=StudentFindOrCreateResponse, status_code=200)
async def find_or_create_student_endpoint(
    body: StudentFindOrCreate,
    session: AsyncSession = Depends(get_session),
) -> StudentFindOrCreateResponse:
    student, created = await find_or_create_student(
        session,
        last_name=body.last_name,
        first_name=body.first_name,
        middle_name=body.middle_name,
        phone=body.phone,
    )
    await commit_session(session)
    await session.refresh(student)
    return StudentFindOrCreateResponse(student=student, created=created)


@router.post("", response_model=StudentRead, status_code=201)
async def create_student(
    body: StudentCreate,
    session: AsyncSession = Depends(get_session),
) -> Student:
    student = Student(**body.model_dump())
    session.add(student)
    await commit_session(session)
    await session.refresh(student)
    return student


@router.post("/import")
async def import_students_from_excel(
    mode: ImportMode = Query("update"),
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_session),
) -> dict:
    filename = file.filename or ""
    if not filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Разрешены только файлы Excel: .xlsx или .xls")

    payload = await file.read()
    if not payload:
        raise HTTPException(status_code=400, detail="Файл пуст.")

    service = ExcelImportService()
    try:
        result = await service.import_bytes(session, payload, mode=mode)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return result.as_dict()


@router.get("", response_model=list[StudentRead])
async def list_students(
    session: AsyncSession = Depends(get_session),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    is_active: bool | None = None,
) -> list[Student]:
    stmt = select(Student).order_by(Student.student_id).offset(skip).limit(limit)
    if is_active is not None:
        stmt = stmt.where(Student.is_active.is_(is_active))
    result = await session.execute(stmt)
    return list(result.scalars().all())


@router.get("/{student_id}", response_model=StudentRead)
async def get_student(
    student_id: int,
    session: AsyncSession = Depends(get_session),
) -> Student:
    student = await session.get(Student, student_id)
    if student is None:
        raise HTTPException(status_code=404, detail="Студент не найден.")
    return student


@router.patch("/{student_id}", response_model=StudentRead)
async def update_student(
    student_id: int,
    body: StudentUpdate,
    session: AsyncSession = Depends(get_session),
) -> Student:
    student = await session.get(Student, student_id)
    if student is None:
        raise HTTPException(status_code=404, detail="Студент не найден.")
    data = body.model_dump(exclude_unset=True)
    if not data:
        return student
    for key, value in data.items():
        setattr(student, key, value)
    student.updated_at = datetime.now().replace(tzinfo=None)
    session.add(student)
    await commit_session(session)
    await session.refresh(student)
    return student


@router.delete("/{student_id}", status_code=204)
async def delete_student(
    student_id: int,
    session: AsyncSession = Depends(get_session),
) -> Response:
    student = await session.get(Student, student_id)
    if student is None:
        raise HTTPException(status_code=404, detail="Студент не найден.")
    await session.delete(student)
    await commit_session(session)
    return Response(status_code=204)
