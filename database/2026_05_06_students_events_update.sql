-- Изменения для существующей базы:
-- 1. students.phone становится обязательным числовым уникальным идентификатором.
-- 2. Добавляется уникальность пары passport_series + passport_number.
-- 3. Тип мероприятия выносится в отдельный справочник event_types.
-- 4. event_participation разделяется на шапку участия и конкретные интервалы участия.

begin;

do $$
begin
    if exists (
        select 1
        from students
        where phone is null
           or nullif(regexp_replace(phone::text, '[^0-9]', '', 'g'), '') is null
    ) then
        raise exception 'Нельзя сделать students.phone обязательным: есть студенты без телефона.';
    end if;

    if exists (
        select 1
        from (
            select nullif(regexp_replace(phone::text, '[^0-9]', '', 'g'), '')::bigint as normalized_phone
            from students
        ) phones
        group by normalized_phone
        having count(*) > 1
    ) then
        raise exception 'Нельзя добавить уникальность students.phone: есть дубли телефонов.';
    end if;

    if exists (
        select 1
        from students
        where passport_series is not null
          and passport_number is not null
        group by passport_series, passport_number
        having count(*) > 1
    ) then
        raise exception 'Нельзя добавить уникальность паспорта: есть дубли passport_series + passport_number.';
    end if;
end $$;

alter table students
    alter column phone type bigint
    using nullif(regexp_replace(phone::text, '[^0-9]', '', 'g'), '')::bigint;

alter table students
    alter column phone set not null;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'uq_students_phone'
          and conrelid = 'students'::regclass
    ) then
        alter table students
            add constraint uq_students_phone unique (phone);
    end if;
end $$;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'uq_students_passport'
          and conrelid = 'students'::regclass
    ) then
        alter table students
            add constraint uq_students_passport unique (passport_series, passport_number);
    end if;
end $$;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'ck_students_phone'
          and conrelid = 'students'::regclass
    ) then
        alter table students
            add constraint ck_students_phone check (phone > 0);
    end if;
end $$;

create table if not exists event_types (
    event_type_id bigserial primary key,
    event_type_name varchar(255) not null,
    description text,
    is_active boolean not null default true,
    created_at timestamp not null default now(),

    constraint uq_event_types_name unique (event_type_name),
    constraint ck_event_types_name_not_blank check (btrim(event_type_name) <> '')
);

alter table events
    add column if not exists event_type_id bigint;

alter table events
    add column if not exists event_comment text;

alter table events
    drop column if exists organization_id;

do $$
begin
    if exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'events'
          and column_name = 'event_type'
    ) then
        execute $sql$
            insert into event_types (event_type_name)
            select distinct btrim(event_type)
            from events
            where event_type is not null
              and btrim(event_type) <> ''
            on conflict (event_type_name) do nothing
        $sql$;

        execute $sql$
            update events e
            set event_type_id = et.event_type_id
            from event_types et
            where btrim(e.event_type) = et.event_type_name
              and e.event_type_id is null
        $sql$;

        alter table events
            drop column event_type;
    end if;
end $$;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'fk_events_event_type'
          and conrelid = 'events'::regclass
    ) then
        alter table events
            add constraint fk_events_event_type
            foreign key (event_type_id)
            references event_types(event_type_id)
            on delete restrict;
    end if;
end $$;

create index if not exists ix_events_event_type
    on events(event_type_id);

comment on table event_types is 'Справочник типов мероприятий.';
comment on column event_types.event_type_name is 'Название типа мероприятия, например: выездное профориентационное мероприятие.';
comment on column events.event_type_id is 'Ссылка на справочник типов мероприятий.';
comment on column events.event_comment is 'Комментарий к мероприятию.';

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

do $$
begin
    if exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'event_participation'
          and column_name = 'participation_date'
    ) and exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'event_participation'
          and column_name = 'participation_hours'
    ) then
        if exists (
            select 1
            from event_participation
            where participation_hours is not null
              and participation_date is null
        ) then
            raise exception 'Нельзя перенести старые часы участия: у части записей нет participation_date.';
        end if;

        if exists (
            select 1
            from event_participation ep
            join events e on e.event_id = ep.event_id
            where ep.participation_date is not null
              and (
                  e.start_time is null
                  or e.end_time is null
                  or e.end_time <= e.start_time
              )
        ) then
            raise exception 'Нельзя перенести старые даты участия: у связанных мероприятий нет корректного start_time/end_time.';
        end if;

        insert into event_participation_time_slots (
            participation_id,
            participation_date,
            start_time,
            end_time,
            participation_hours
        )
        select
            ep.participation_id,
            ep.participation_date,
            e.start_time,
            e.end_time,
            coalesce(
                ep.participation_hours,
                (
                    extract(epoch from (
                        (ep.participation_date + e.end_time)
                        - (ep.participation_date + e.start_time)
                    )) / 3600
                )::numeric(6,2)
            ) as participation_hours
        from event_participation ep
        join events e on e.event_id = ep.event_id
        where ep.participation_date is not null
        on conflict on constraint uq_event_participation_time_slot do nothing;
    end if;
end $$;

alter table event_participation
    drop constraint if exists ck_event_participation_hours;

alter table event_participation
    drop column if exists participation_date;

alter table event_participation
    drop column if exists participation_hours;

create index if not exists ix_event_participation_student
    on event_participation(student_id);

create index if not exists ix_event_participation_event
    on event_participation(event_id);

create index if not exists ix_event_participation_time_slots_date
    on event_participation_time_slots(participation_date);

create or replace view event_participation_summary as
select
    ep.participation_id,
    ep.student_id,
    ep.event_id,
    ep.role_name,
    ep.participation_status,
    min(epts.participation_date) as first_participation_date,
    max(epts.participation_date) as last_participation_date,
    count(epts.participation_time_slot_id) as participation_time_slots_count,
    coalesce(sum(epts.participation_hours), 0)::numeric(8,2) as total_participation_hours
from event_participation ep
left join event_participation_time_slots epts
    on epts.participation_id = ep.participation_id
group by
    ep.participation_id,
    ep.student_id,
    ep.event_id,
    ep.role_name,
    ep.participation_status;

commit;
