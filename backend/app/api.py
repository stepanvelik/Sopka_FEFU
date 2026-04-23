import asyncpg.exceptions
from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession


def _walk_asyncpg_exceptions(exc: BaseException | None) -> BaseException | None:
    seen: set[int] = set()
    cur: BaseException | None = exc
    while cur is not None and id(cur) not in seen:
        seen.add(id(cur))
        if isinstance(cur, asyncpg.exceptions.PostgresError):
            return cur
        cur = cur.__cause__
    return None


async def commit_session(session: AsyncSession) -> None:
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        pg = _walk_asyncpg_exceptions(exc.orig) or _walk_asyncpg_exceptions(exc.__cause__)
        if isinstance(pg, asyncpg.exceptions.UniqueViolationError):
            raise HTTPException(
                status_code=409,
                detail="Нарушение уникальности (например, СНИЛС или ИНН уже заняты).",
            ) from exc
        if isinstance(pg, asyncpg.exceptions.CheckViolationError):
            raise HTTPException(
                status_code=422,
                detail="Данные не прошли проверку в базе (ограничения CHECK).",
            ) from exc
        raise HTTPException(status_code=409, detail="Ошибка целостности данных.") from exc
