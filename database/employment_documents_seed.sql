-- Заполнение данных для формирования документов на трудоустройство без ошибок.
-- Можно запускать повторно: обновляет пустые поля и дополняет связанные таблицы.

begin;

-- 1. Адрес регистрации и корпоративная почта для всех активных студентов
update students
set
    registration_address = coalesce(
        nullif(trim(registration_address), ''),
        format(
            'г. Владивосток, ул. Светланская, д. %s, кв. %s',
            lpad((student_id % 50 + 1)::text, 2, '0'),
            lpad((student_id % 120 + 1)::text, 3, '0')
        )
    ),
    residential_address = coalesce(
        nullif(trim(residential_address), ''),
        coalesce(
            nullif(trim(registration_address), ''),
            format(
                'г. Владивосток, ул. Светланская, д. %s, кв. %s',
                lpad((student_id % 50 + 1)::text, 2, '0'),
                lpad((student_id % 120 + 1)::text, 3, '0')
            )
        )
    ),
    corporate_email = coalesce(
        nullif(trim(corporate_email), ''),
        nullif(trim(email), ''),
        lower(
            translate(
                replace(last_name || '.' || left(first_name, 1), ' ', ''),
                'абвгдеёжзийклмнопрстуфхцчшщъыьэюяАБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ',
                'abvgdeejzijklmnoprstufhzcss_y_euaABVGDEEJZIJKLMNOPRSTUFHZCSS_Y_EUA'
            )
        ) || student_id::text || '@dvfu.ru'
    ),
    updated_at = now()
where is_active = true;

-- 2. Паспортные данные там, где они ещё не заполнены
update students
set
    passport_series = coalesce(nullif(trim(passport_series), ''), lpad((5000 + student_id)::text, 4, '0')),
    passport_number = coalesce(nullif(trim(passport_number), ''), lpad((100000 + student_id)::text, 6, '0')),
    passport_issued_by = coalesce(
        nullif(trim(passport_issued_by), ''),
        'УФМС России по Приморскому краю в г. Владивостоке'
    ),
    passport_issue_date = coalesce(passport_issue_date, date '2020-06-15'),
    passport_department_code = coalesce(nullif(trim(passport_department_code), ''), '250-001'),
    snils = coalesce(
        nullif(trim(snils), ''),
        lpad((10000000000 + student_id)::text, 11, '0')
    ),
    inn = coalesce(
        nullif(trim(inn), ''),
        lpad((100000000000 + student_id)::text, 12, '0')
    ),
    updated_at = now()
where is_active = true
  and (
      passport_series is null or trim(passport_series) = ''
      or passport_number is null or trim(passport_number) = ''
      or passport_issued_by is null or trim(passport_issued_by) = ''
      or passport_issue_date is null
      or snils is null or trim(snils) = ''
      or inn is null or trim(inn) = ''
  );

-- 3. Нормализация СНИЛС/ИНН до нужной длины
update students
set
    snils = lpad(regexp_replace(snils, '\D', '', 'g'), 11, '0'),
    inn = lpad(regexp_replace(inn, '\D', '', 'g'), 12, '0'),
    updated_at = now()
where is_active = true
  and (
      length(regexp_replace(snils, '\D', '', 'g')) < 11
      or length(regexp_replace(inn, '\D', '', 'g')) < 12
  );

-- 4. Исправление дубликата телефона (Валеева / Абрамова)
update students
set
    phone = '79' || lpad((9000000000 + student_id)::text, 10, '0'),
    updated_at = now()
where student_id = 78
  and exists (
      select 1
      from students other
      where other.student_id <> students.student_id
        and other.phone = students.phone
  );

-- 5. Банковские реквизиты: нормализация БИК и добавление отсутствующих записей
update bank_details
set
    bik = lpad(regexp_replace(bik, '\D', '', 'g'), 9, '0'),
    account_number = lpad(regexp_replace(account_number, '\D', '', 'g'), 20, '0'),
    correspondent_account = coalesce(
        nullif(trim(correspondent_account), ''),
        '30101810400000000225'
    )
where length(regexp_replace(bik, '\D', '', 'g')) < 9
   or length(regexp_replace(account_number, '\D', '', 'g')) < 20
   or correspondent_account is null
   or trim(correspondent_account) = '';

insert into bank_details (
    student_id,
    bank_name,
    bik,
    correspondent_account,
    account_number,
    is_active
)
select
    s.student_id,
    'ПАО Сбербанк',
    '044525225',
    '30101810400000000225',
    lpad((40817810000000000000 + s.student_id)::text, 20, '0'),
    true
from students s
where s.is_active = true
  and not exists (
      select 1
      from bank_details bd
      where bd.student_id = s.student_id
  );

-- 6. Данные ГПХ для Excel
insert into gph_contract_data (
    contract_number,
    contract_date,
    contract_term_text,
    service_term_text,
    student_id,
    bank_details_id,
    reward_amount,
    reward_amount_text,
    customer_name,
    customer_status,
    customer_phone,
    customer_email,
    status
)
select
    null,
    date '2024-06-10',
    '10.07.2023 г. до 30.09.2024',
    '10.06.2024 по 20.09.2024',
    s.student_id,
    (
        select bd.bank_details_id
        from bank_details bd
        where bd.student_id = s.student_id
        order by bd.is_active desc, bd.bank_details_id desc
        limit 1
    ),
    50000.00,
    'пятидесяти тысяч рублей 00 копеек',
    'Федеральное государственное автономное образовательное учреждение высшего образования «Дальневосточный федеральный университет»',
    'в лице Департамента по работе с абитуриентами',
    '8(423)243-11-94',
    'sopka@mail.dvfu.ru',
    'подготовлено'
from students s
where s.is_active = true
  and not exists (
      select 1
      from gph_contract_data g
      where g.student_id = s.student_id
  );

update gph_contract_data g
set
    contract_date = coalesce(g.contract_date, date '2024-06-10'),
    contract_term_text = coalesce(nullif(trim(g.contract_term_text), ''), '10.07.2023 г. до 30.09.2024'),
    service_term_text = coalesce(nullif(trim(g.service_term_text), ''), '10.06.2024 по 20.09.2024'),
    reward_amount = coalesce(g.reward_amount, 50000.00),
    reward_amount_text = coalesce(nullif(trim(g.reward_amount_text), ''), 'пятидесяти тысяч рублей 00 копеек'),
    customer_name = coalesce(
        nullif(trim(g.customer_name), ''),
        'Федеральное государственное автономное образовательное учреждение высшего образования «Дальневосточный федеральный университет»'
    ),
    customer_status = coalesce(nullif(trim(g.customer_status), ''), 'в лице Департамента по работе с абитуриентами'),
    customer_phone = coalesce(nullif(trim(g.customer_phone), ''), '8(423)243-11-94'),
    customer_email = coalesce(nullif(trim(g.customer_email), ''), 'sopka@mail.dvfu.ru'),
    bank_details_id = coalesce(
        g.bank_details_id,
        (
            select bd.bank_details_id
            from bank_details bd
            where bd.student_id = g.student_id
            order by bd.is_active desc, bd.bank_details_id desc
            limit 1
        )
    )
from students s
where g.student_id = s.student_id
  and s.is_active = true;

commit;
