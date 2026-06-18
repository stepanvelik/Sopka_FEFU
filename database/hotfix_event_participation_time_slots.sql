-- Таблица интервалов участия (если БД создана до миграции 2026_05_06).
begin;

alter table event_participation
    add column if not exists updated_at timestamp not null default now();

create table if not exists event_participation_time_slots (
    participation_time_slot_id bigserial primary key,
    participation_id bigint not null references event_participation(participation_id) on delete cascade,

    participation_date date not null,
    start_time time not null,
    end_time time not null,
    participation_hours numeric(6,2) not null,
    notes text,

    created_at timestamp not null default now(),

    constraint uq_event_participation_time_slot unique (
        participation_id,
        participation_date,
        start_time,
        end_time
    ),
    constraint ck_event_participation_time_slot_times check (end_time > start_time),
    constraint ck_event_participation_time_slot_hours check (
        participation_hours > 0 and participation_hours <= 24
    )
);

create index if not exists ix_event_participation_time_slots_date
    on event_participation_time_slots(participation_date);

commit;
