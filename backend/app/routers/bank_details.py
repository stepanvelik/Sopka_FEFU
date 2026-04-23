from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import commit_session
from app.database import get_session
from app.models.bank_details import BankDetails
from app.models.student import Student
from app.schemas.bank_details import BankDetailsCreate, BankDetailsRead, BankDetailsUpdate

nested = APIRouter(prefix="/students/{student_id}/bank-details", tags=["bank-details"])
root = APIRouter(prefix="/bank-details", tags=["bank-details"])


async def _get_student_or_404(session: AsyncSession, student_id: int) -> Student:
    student = await session.get(Student, student_id)
    if student is None:
        raise HTTPException(status_code=404, detail="Студент не найден.")
    return student


@nested.post("", response_model=BankDetailsRead, status_code=201)
async def create_bank_details_for_student(
    student_id: int,
    body: BankDetailsCreate,
    session: AsyncSession = Depends(get_session),
) -> BankDetails:
    await _get_student_or_404(session, student_id)
    row = BankDetails(student_id=student_id, **body.model_dump())
    session.add(row)
    await commit_session(session)
    await session.refresh(row)
    return row


@nested.get("", response_model=list[BankDetailsRead])
async def list_bank_details_for_student(
    student_id: int,
    session: AsyncSession = Depends(get_session),
    active_only: bool | None = Query(
        None,
        description="Если true — только активные записи (is_active = true).",
    ),
) -> list[BankDetails]:
    await _get_student_or_404(session, student_id)
    stmt = select(BankDetails).where(BankDetails.student_id == student_id).order_by(BankDetails.bank_details_id)
    if active_only is True:
        stmt = stmt.where(BankDetails.is_active.is_(True))
    elif active_only is False:
        stmt = stmt.where(BankDetails.is_active.is_(False))
    result = await session.execute(stmt)
    return list(result.scalars().all())


@root.get("/{bank_details_id}", response_model=BankDetailsRead)
async def get_bank_details(
    bank_details_id: int,
    session: AsyncSession = Depends(get_session),
) -> BankDetails:
    row = await session.get(BankDetails, bank_details_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Банковские реквизиты не найдены.")
    return row


@root.patch("/{bank_details_id}", response_model=BankDetailsRead)
async def update_bank_details(
    bank_details_id: int,
    body: BankDetailsUpdate,
    session: AsyncSession = Depends(get_session),
) -> BankDetails:
    row = await session.get(BankDetails, bank_details_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Банковские реквизиты не найдены.")
    data = body.model_dump(exclude_unset=True)
    if not data:
        return row
    for key, value in data.items():
        setattr(row, key, value)
    session.add(row)
    await commit_session(session)
    await session.refresh(row)
    return row


router = APIRouter()
router.include_router(nested)
router.include_router(root)
