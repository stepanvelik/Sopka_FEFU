"""Лёгкие идемпотентные правки схемы при старте (без отдельного шага миграции вручную)."""

from sqlalchemy import text

from app.database import engine

EVENT_TYPE_SEED = (
    "Олимпиада",
    "Конференция",
    "Семинар",
    "Мастер-класс",
    "Спортивное соревнование",
    "Выездное мероприятие",
    "Волонтёрский проект",
    "Профориентация",
    "Культурное мероприятие",
    "Научная школа",
    "Хакатон",
    "Форум",
)


async def apply_startup_schema_patches() -> None:
    """Добавляет колонки, которых может не быть в старых БД. Безопасно вызывать многократно."""
    async with engine.begin() as conn:
        await conn.execute(text("alter table students drop constraint if exists ck_students_phone"))
        await conn.execute(text("alter table students alter column phone type varchar(30) using phone::varchar"))
        await conn.execute(text("alter table students alter column phone set not null"))
        await conn.execute(
            text(
                """
                do $$
                begin
                    if not exists (
                        select 1
                        from pg_constraint
                        where conname = 'ck_students_phone'
                          and conrelid = 'students'::regclass
                    ) then
                        alter table students
                            add constraint ck_students_phone check (phone ~ '[0-9]');
                    end if;
                end $$;
                """
            ),
        )
        await conn.execute(
            text("alter table events add column if not exists event_daily_schedule jsonb"),
        )
        for name in EVENT_TYPE_SEED:
            await conn.execute(
                text(
                    "insert into event_types (event_type_name, description, is_active) "
                    "values (:name, null, true) "
                    "on conflict (event_type_name) do nothing"
                ),
                {"name": name},
            )
