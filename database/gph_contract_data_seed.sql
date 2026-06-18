-- Демо-данные для формы ГПХ (gph_contract_data).
-- Скрипт можно запускать повторно: для каждого активного студента создаётся
-- или обновляется одна запись с данными договора.
-- Поля заказчика одинаковые для всех записей (как в примере заполнения формы).

begin;

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

update gph_contract_data
set
    contract_date = coalesce(contract_date, date '2024-06-10'),
    contract_term_text = coalesce(nullif(trim(contract_term_text), ''), '10.07.2023 г. до 30.09.2024'),
    service_term_text = coalesce(nullif(trim(service_term_text), ''), '10.06.2024 по 20.09.2024'),
    reward_amount = coalesce(reward_amount, 50000.00),
    reward_amount_text = coalesce(nullif(trim(reward_amount_text), ''), 'пятидесяти тысяч рублей 00 копеек'),
    customer_name = coalesce(
        nullif(trim(customer_name), ''),
        'Федеральное государственное автономное образовательное учреждение высшего образования «Дальневосточный федеральный университет»'
    ),
    customer_status = coalesce(nullif(trim(customer_status), ''), 'в лице Департамента по работе с абитуриентами'),
    customer_phone = coalesce(nullif(trim(customer_phone), ''), '8(423)243-11-94'),
    customer_email = coalesce(nullif(trim(customer_email), ''), 'sopka@mail.dvfu.ru')
where status = 'подготовлено';

commit;
