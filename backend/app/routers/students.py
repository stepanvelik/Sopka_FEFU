from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import commit_session
from app.database import get_session
from app.models.student import Student
from app.schemas.student import StudentCreate, StudentRead, StudentUpdate

router = APIRouter(prefix="/students", tags=["students"])


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
