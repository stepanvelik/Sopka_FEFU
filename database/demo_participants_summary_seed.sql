-- Данные мероприятий для проверки отчетов и справок.
-- Скрипт можно запускать повторно: он удаляет и пересоздает только эти мероприятия.
-- Студентов не вставляет: они должны быть уже загружены, связи строятся по телефонам.

begin;

insert into event_types (event_type_name, description, is_active)
values
    ('День открытых дверей', 'Очные мероприятия для знакомства абитуриентов с университетом.', true),
    ('Профориентационный выезд', 'Выездные встречи команды ДВФУ со школьниками.', true),
    ('Работа с обращениями и звонками', 'Консультации абитуриентов и обработка обращений.', true),
    ('Обучение участников отряда', 'Подготовка участников к работе на мероприятиях.', true),
    ('Фестиваль науки', 'Научно-популярные мероприятия для школьников и абитуриентов.', true),
    ('Профориентационная встреча', 'Встречи с будущими абитуриентами в школах и колледжах.', true),
    ('Карьерное мероприятие', 'Мероприятия о траекториях обучения и карьеры.', true),
    ('Форум', 'Крупные события для будущих студентов и партнеров.', true)
on conflict (event_type_name) do update
set
    description = excluded.description,
    is_active = true;

delete from events
where event_name like '[Тест] %'
   or event_comment in (
       'Тестовые данные для проверки сводной таблицы.',
       'Демо-данные для проверки сводной таблицы.'
   )
   or event_name in (
       'День открытых дверей ДВФУ 2026',
       'Профориентационный выезд в школы Владивостока',
       'Консультации абитуриентов ЕКЦ',
       'Обучение участников СОПКа',
       'Фестиваль науки для школьников',
       'Профориентационная встреча в школе N 23',
       'Карьерный навигатор ДВФУ',
       'Форум будущих студентов',
       'День открытых дверей ДВФУ: программы и кампус',
       'Профориентационный выезд ДВФУ в школы Владивостока',
       'Линия консультаций для абитуриентов ДВФУ',
       'Обучение участников студенческого отряда профориентации ДВФУ',
       'Фестиваль науки ДВФУ для школьников Приморья',
       'Профориентационная встреча ДВФУ в школе N 23',
       'Карьерное мероприятие ДВФУ «Навигатор профессий»',
       'Форум ДВФУ для будущих студентов'
   );

with event_defs as (
    select *
    from (
        values
            (
                'open_day',
                'День открытых дверей ДВФУ: программы и кампус',
                'Университетский',
                'День открытых дверей',
                'Центр привлечения абитуриентов',
                date '2026-01-15',
                date '2026-01-15',
                28,
                8.00::numeric(6,2),
                '[{"date":"2026-01-15","start_time":"09:00:00","end_time":"17:00:00"}]'::jsonb,
                'Знакомство школьников и родителей с образовательными программами, кампусом и приемной кампанией ДВФУ.'
            ),
            (
                'school_trip',
                'Профориентационный выезд ДВФУ в школы Владивостока',
                'Городской',
                'Профориентационный выезд',
                'Приемная комиссия ДВФУ',
                date '2026-02-06',
                date '2026-02-07',
                31,
                12.00::numeric(6,2),
                '[{"date":"2026-02-06","start_time":"10:00:00","end_time":"16:00:00"},{"date":"2026-02-07","start_time":"10:00:00","end_time":"16:00:00"}]'::jsonb,
                'Выездная серия встреч со старшеклассниками о направлениях подготовки и поступлении в ДВФУ.'
            ),
            (
                'calls',
                'Линия консультаций для абитуриентов ДВФУ',
                'Университетский',
                'Работа с обращениями и звонками',
                'Единый контактный центр',
                date '2026-02-26',
                date '2026-02-27',
                32,
                16.00::numeric(6,2),
                '[{"date":"2026-02-26","start_time":"09:00:00","end_time":"17:00:00"},{"date":"2026-02-27","start_time":"09:00:00","end_time":"17:00:00"}]'::jsonb,
                'Консультационная линия для обработки звонков и обращений абитуриентов по приемной кампании.'
            ),
            (
                'training',
                'Обучение участников студенческого отряда профориентации ДВФУ',
                'Институтский',
                'Обучение участников отряда',
                'Штаб СОПКа',
                date '2026-03-18',
                date '2026-03-18',
                38,
                4.00::numeric(6,2),
                '[{"date":"2026-03-18","start_time":"09:00:00","end_time":"13:00:00"}]'::jsonb,
                'Подготовка участников отряда к сопровождению профориентационных мероприятий и работе с гостями.'
            ),
            (
                'science',
                'Фестиваль науки ДВФУ для школьников Приморья',
                'Региональный',
                'Фестиваль науки',
                'Проектный офис ДВФУ',
                date '2026-04-08',
                date '2026-04-08',
                31,
                6.00::numeric(6,2),
                '[{"date":"2026-04-08","start_time":"11:00:00","end_time":"17:00:00"}]'::jsonb,
                'Научно-популярные площадки, лекции и интерактивные зоны для школьников Приморского края.'
            ),
            (
                'career_guidance',
                'Профориентационная встреча ДВФУ в школе N 23',
                'Городской',
                'Профориентационная встреча',
                'Приемная комиссия ДВФУ',
                date '2026-04-25',
                date '2026-04-25',
                31,
                5.00::numeric(6,2),
                '[{"date":"2026-04-25","start_time":"12:00:00","end_time":"17:00:00"}]'::jsonb,
                'Очная встреча со школьниками о выборе образовательной программы и подготовке к поступлению.'
            ),
            (
                'career',
                'Карьерное мероприятие ДВФУ «Навигатор профессий»',
                'Университетский',
                'Карьерное мероприятие',
                'Центр карьеры ДВФУ',
                date '2026-05-14',
                date '2026-05-14',
                27,
                6.00::numeric(6,2),
                '[{"date":"2026-05-14","start_time":"10:00:00","end_time":"16:00:00"}]'::jsonb,
                'Профориентационная площадка о карьерных траекториях, стажировках и образовательных возможностях.'
            ),
            (
                'forum',
                'Форум ДВФУ для будущих студентов',
                'Региональный',
                'Форум',
                'ДВФУ',
                date '2026-05-29',
                date '2026-05-29',
                30,
                7.00::numeric(6,2),
                '[{"date":"2026-05-29","start_time":"09:00:00","end_time":"16:00:00"}]'::jsonb,
                'Региональная площадка для будущих студентов о поступлении, студенческой жизни и проектах ДВФУ.'
            )
    ) as event_defs(
        event_key,
        event_name,
        event_level,
        event_type_name,
        organizer_name,
        start_date,
        end_date,
        participants_planned,
        duration_hours,
        event_daily_schedule,
        event_comment
    )
),
inserted_events as (
    insert into events (
        event_name,
        event_level,
        event_type_id,
        organizer_name,
        start_date,
        end_date,
        start_time,
        end_time,
        participants_planned,
        duration_hours,
        event_comment,
        event_daily_schedule
    )
    select
        ed.event_name,
        ed.event_level,
        et.event_type_id,
        ed.organizer_name,
        ed.start_date,
        ed.end_date,
        null,
        null,
        ed.participants_planned,
        ed.duration_hours,
        ed.event_comment,
        ed.event_daily_schedule
    from event_defs ed
    join event_types et
        on et.event_type_name = ed.event_type_name
    returning event_id, event_name
),
students_pool as (
    select
        s.student_id,
        s.phone,
        row_number() over (order by s.student_id) as rn
    from students s
    join (
        values
            (79991234567::bigint),
            (79992345678::bigint),
            (79993456789::bigint),
            (79994567890::bigint),
            (79995678901::bigint),
            (79996789012::bigint),
            (79997890123::bigint),
            (79998901234::bigint),
            (79990012345::bigint),
            (79991112233::bigint),
            (79992223344::bigint),
            (79993334455::bigint),
            (79994445566::bigint),
            (79995556677::bigint),
            (79996667788::bigint),
            (79997778899::bigint),
            (79998889900::bigint),
            (79999990011::bigint),
            (79990001122::bigint),
            (79991002233::bigint),
            (79992003344::bigint),
            (79993004455::bigint),
            (79994005566::bigint),
            (79995006677::bigint),
            (79996007788::bigint),
            (79997008899::bigint),
            (79991110011::bigint),
            (79992220022::bigint),
            (79993330033::bigint),
            (79994440044::bigint),
            (79995550055::bigint),
            (79996660066::bigint),
            (79997770077::bigint),
            (79998880088::bigint),
            (79999990099::bigint),
            (79990100100::bigint),
            (79991201201::bigint),
            (79992302302::bigint),
            (79993403403::bigint),
            (79994504504::bigint),
            (79995605605::bigint),
            (79996706706::bigint),
            (79997807807::bigint),
            (79998908908::bigint),
            (79990009009::bigint),
            (79991110110::bigint),
            (79992211211::bigint),
            (79993312312::bigint),
            (79994413413::bigint),
            (79995514514::bigint),
            (79996615615::bigint),
            (79997716716::bigint),
            (79998817817::bigint),
            (79999918918::bigint),
            (79990019019::bigint),
            (79991120120::bigint),
            (79992221221::bigint),
            (79993322322::bigint),
            (79994423423::bigint),
            (79995524524::bigint),
            (79996625625::bigint),
            (79997726726::bigint),
            (79998827827::bigint),
            (79999928928::bigint),
            (79990029029::bigint),
            (79991130130::bigint),
            (79992231231::bigint),
            (79993332332::bigint),
            (79994433433::bigint),
            (79995534534::bigint),
            (79996635635::bigint),
            (79997736736::bigint),
            (79998837837::bigint),
            (79999938938::bigint),
            (79990039039::bigint),
            (79991140140::bigint)
    ) as phones(phone)
        on phones.phone = s.phone
),
assignments as (
    select
        sp.student_id,
        sp.rn,
        ie.event_id,
        ed.event_key
    from students_pool sp
    cross join inserted_events ie
    join event_defs ed
        on ed.event_name = ie.event_name
    where
        (ed.event_key = 'open_day' and sp.rn <= 28)
        or (ed.event_key = 'school_trip' and sp.rn between 15 and 45)
        or (ed.event_key = 'calls' and (sp.rn % 3 = 0 or sp.rn <= 10))
        or (ed.event_key = 'training' and sp.rn % 4 in (1, 2))
        or (ed.event_key = 'science' and sp.rn between 35 and 65)
        or (ed.event_key = 'career_guidance' and sp.rn % 5 in (0, 1))
        or (ed.event_key = 'career' and sp.rn between 50 and 76)
        or (ed.event_key = 'forum' and sp.rn % 2 = 0 and sp.rn <= 60)
),
inserted_participation as (
    insert into event_participation (
        student_id,
        event_id,
        role_name,
        participation_status,
        notes
    )
    select
        a.student_id,
        a.event_id,
        case
            when (a.event_key = 'open_day' and a.rn = 1)
              or (a.event_key = 'forum' and a.rn = 60)
                then 'Руководитель'
            when a.rn % 11 = 0
                then 'Организатор'
            when a.rn % 3 = 0
                then 'Волонтер'
            when a.rn % 5 = 0
                then 'Участник'
            else 'Исполнитель'
        end,
        'completed',
        'Демо-запись участия для проверки сводной таблицы.'
    from assignments a
    returning participation_id, event_id, student_id
),
slot_rows as (
    select
        pi.participation_id,
        date '2026-01-15' as participation_date,
        case when sp.rn % 3 = 0 then time '09:00' else time '10:00' end as start_time,
        case when sp.rn % 3 = 0 then time '17:00' else time '14:00' end as end_time,
        case when sp.rn % 3 = 0 then 8.00::numeric(6,2) else 4.00::numeric(6,2) end as participation_hours
    from inserted_participation pi
    join students_pool sp on sp.student_id = pi.student_id
    join inserted_events ie on ie.event_id = pi.event_id
    join event_defs ed on ed.event_name = ie.event_name
    where ed.event_key = 'open_day'

    union all

    select pi.participation_id, date '2026-02-06', time '10:00', time '16:00', 6.00::numeric(6,2)
    from inserted_participation pi
    join inserted_events ie on ie.event_id = pi.event_id
    join event_defs ed on ed.event_name = ie.event_name
    where ed.event_key = 'school_trip'

    union all

    select
        pi.participation_id,
        date '2026-02-07',
        case when sp.rn % 2 = 0 then time '09:00' else time '11:00' end,
        case when sp.rn % 2 = 0 then time '15:00' else time '17:00' end,
        6.00::numeric(6,2)
    from inserted_participation pi
    join students_pool sp on sp.student_id = pi.student_id
    join inserted_events ie on ie.event_id = pi.event_id
    join event_defs ed on ed.event_name = ie.event_name
    where ed.event_key = 'school_trip'

    union all

    select
        pi.participation_id,
        date '2026-02-26',
        case when sp.rn % 2 = 0 then time '09:00' else time '13:00' end,
        case when sp.rn % 2 = 0 then time '13:00' else time '17:00' end,
        4.00::numeric(6,2)
    from inserted_participation pi
    join students_pool sp on sp.student_id = pi.student_id
    join inserted_events ie on ie.event_id = pi.event_id
    join event_defs ed on ed.event_name = ie.event_name
    where ed.event_key = 'calls'

    union all

    select pi.participation_id, date '2026-02-27', time '09:00', time '13:00', 4.00::numeric(6,2)
    from inserted_participation pi
    join students_pool sp on sp.student_id = pi.student_id
    join inserted_events ie on ie.event_id = pi.event_id
    join event_defs ed on ed.event_name = ie.event_name
    where ed.event_key = 'calls'
      and sp.rn % 5 = 0

    union all

    select pi.participation_id, date '2026-03-18', time '09:00', time '13:00', 4.00::numeric(6,2)
    from inserted_participation pi
    join inserted_events ie on ie.event_id = pi.event_id
    join event_defs ed on ed.event_name = ie.event_name
    where ed.event_key = 'training'

    union all

    select pi.participation_id, date '2026-04-08', time '11:00', time '17:00', 6.00::numeric(6,2)
    from inserted_participation pi
    join inserted_events ie on ie.event_id = pi.event_id
    join event_defs ed on ed.event_name = ie.event_name
    where ed.event_key = 'science'

    union all

    select pi.participation_id, date '2026-04-25', time '12:00', time '17:00', 5.00::numeric(6,2)
    from inserted_participation pi
    join inserted_events ie on ie.event_id = pi.event_id
    join event_defs ed on ed.event_name = ie.event_name
    where ed.event_key = 'career_guidance'

    union all

    select pi.participation_id, date '2026-05-14', time '10:00', time '16:00', 6.00::numeric(6,2)
    from inserted_participation pi
    join inserted_events ie on ie.event_id = pi.event_id
    join event_defs ed on ed.event_name = ie.event_name
    where ed.event_key = 'career'

    union all

    select pi.participation_id, date '2026-05-29', time '09:00', time '16:00', 7.00::numeric(6,2)
    from inserted_participation pi
    join inserted_events ie on ie.event_id = pi.event_id
    join event_defs ed on ed.event_name = ie.event_name
    where ed.event_key = 'forum'
)
insert into event_participation_time_slots (
    participation_id,
    participation_date,
    start_time,
    end_time,
    participation_hours,
    notes
)
select
    participation_id,
    participation_date,
    start_time,
    end_time,
    participation_hours,
    'Демо-часы участия.'
from slot_rows;

commit;
