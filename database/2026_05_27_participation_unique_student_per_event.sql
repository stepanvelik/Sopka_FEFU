-- Изменить уникальный constraint: один студент — одно участие в мероприятии (без учёта роли)
-- Было: UNIQUE (student_id, event_id, role_name)
-- Стало: UNIQUE (student_id, event_id)

begin;

-- Если есть дубли (один студент с несколькими ролями), оставляем запись с наименьшим participation_id
delete from event_participation
where participation_id not in (
    select min(participation_id)
    from event_participation
    group by student_id, event_id
);

alter table event_participation
    drop constraint if exists uq_event_participation;

alter table event_participation
    add constraint uq_event_participation unique (student_id, event_id);

commit;
