-- База данных для системы учета студентов, мероприятий и документооборота СОПКа
begin;

-- Справочник организаций: ДВФУ, РСО и иные организации, участвующие в документообороте
create table if not exists organizations (
    organization_id bigserial primary key,
    organization_name varchar(255) not null,
    short_name varchar(100),
    okpo varchar(20),
    ogrn varchar(20),
    inn varchar(20),
    kpp varchar(20),
    legal_address text,
    phone varchar(30),
    email varchar(255),

    created_at timestamp not null default now(),

    constraint uq_organizations_name unique (organization_name)
);

-- Основная таблица студентов: персональные, паспортные, контактные и учебные данные
create table if not exists students (
    student_id bigserial primary key,
    last_name varchar(100) not null,
    first_name varchar(100) not null,
    middle_name varchar(100),
    birth_date date not null,

    -- текущий курс можно получать из study_group
    study_group varchar(50) not null,
    institute varchar(255) not null,

    phone varchar(30),
    email varchar(255), -- может использоваться как корпоративная почта
    corporate_email varchar(255), -- если нужно отдельно хранить корпоративную почту

    registration_address text,
    residential_address text,

    passport_series varchar(10),
    passport_number varchar(20),
    passport_issued_by text,
    passport_issue_date date,
    passport_department_code varchar(20),

    snils varchar(20),
    inn varchar(20),
    rso_member_ticket_no varchar(50),

    is_active boolean not null default true,
    created_at timestamp not null default now(),
    updated_at timestamp not null default now(),

    constraint uq_students_snils unique (snils),
    constraint uq_students_inn unique (inn),
    constraint ck_students_email check (email is null or position('@' in email) > 1),
    constraint ck_students_corporate_email check (corporate_email is null or position('@' in corporate_email) > 1),
    constraint ck_students_birth_date check (birth_date <= current_date),
    constraint ck_students_passport_issue_date check (
        passport_issue_date is null or passport_issue_date <= current_date
    )
);

-- Банковские реквизиты студента для передачи данных на ГПХ
create table if not exists bank_details (
    bank_details_id bigserial primary key,
    student_id bigint not null references students(student_id) on delete cascade,
    bank_name varchar(255) not null,
    bik varchar(20) not null,
    correspondent_account varchar(30),
    account_number varchar(30) not null,
    is_active boolean not null default true,
    created_at timestamp not null default now()
);

-- Заявления на изменение паспортных данных участника
create table if not exists passport_change_applications (
    application_id bigserial primary key,
    application_number varchar(50),
    application_date date not null,
    student_id bigint not null references students(student_id) on delete cascade,
    organization_id bigint references organizations(organization_id) on delete set null,

    new_passport_series varchar(10),
    new_passport_number varchar(20),
    new_passport_issued_by text,
    new_passport_issue_date date,
    new_passport_department_code varchar(20),

    passport_copy_attached boolean not null default false,
    status varchar(50) not null default 'подано',

    created_at timestamp not null default now(),

    constraint uq_passport_change_app_number unique (application_number),
    constraint ck_new_passport_issue_date check (
        new_passport_issue_date is null or new_passport_issue_date <= current_date
    )
);

-- Подписанты справок и иных документов
create table if not exists signers (
    signer_id bigserial primary key,
    full_name varchar(255) not null,
    position_name varchar(255) not null,
    department_name varchar(255),
    organization_id bigint references organizations(organization_id) on delete set null,
    is_active boolean not null default true
);

-- Справочник мероприятий
create table if not exists events (
    event_id bigserial primary key,
    event_name varchar(500) not null,
    event_level varchar(50) not null,
    organizer_name varchar(255),
    organization_id bigint references organizations(organization_id) on delete set null,

    start_date date not null,
    end_date date,
    start_time time,
    end_time time,

    participants_planned integer,
    duration_hours numeric(6,2),

    created_at timestamp not null default now(),

    constraint ck_events_dates check (end_date is null or end_date >= start_date),
    constraint ck_events_participants check (participants_planned is null or participants_planned >= 0),
    constraint ck_events_duration check (duration_hours is null or duration_hours >= 0)
);

-- Факты участия студентов в мероприятиях
create table if not exists event_participation (
    participation_id bigserial primary key,
    student_id bigint not null references students(student_id) on delete cascade,
    event_id bigint not null references events(event_id) on delete cascade,

    participation_date date,
    role_name varchar(100) not null,
    participation_hours numeric(6,2),
    participation_status varchar(50),
    notes text,

    created_at timestamp not null default now(),

    constraint uq_event_participation unique (student_id, event_id, role_name),
    constraint ck_event_participation_hours check (
        participation_hours is null or participation_hours >= 0
    )
);

-- Справки об участии в мероприятии
create table if not exists participation_certificates (
    certificate_id bigserial primary key,
    certificate_number varchar(50),
    issue_date date not null,
    document_name varchar(255) not null default 'Справка об участии в мероприятии',

    student_id bigint not null references students(student_id) on delete restrict,
    event_id bigint not null references events(event_id) on delete restrict,
    organization_id bigint references organizations(organization_id) on delete set null,
    signer_id bigint references signers(signer_id) on delete set null,
    participation_id bigint references event_participation(participation_id) on delete set null,

    issue_status varchar(50) not null default 'подготовлена',
    created_at timestamp not null default now(),

    constraint uq_participation_cert_number unique (certificate_number)
);

-- Справки о пропуске занятий
create table if not exists absence_certificates (
    certificate_id bigserial primary key,
    certificate_number varchar(50),
    issue_date date not null,
    document_name varchar(255) not null default 'Справка о пропуске занятий',

    student_id bigint not null references students(student_id) on delete restrict,
    event_id bigint not null references events(event_id) on delete restrict,
    organization_id bigint references organizations(organization_id) on delete set null,
    signer_id bigint references signers(signer_id) on delete set null,
    participation_id bigint references event_participation(participation_id) on delete set null,

    absence_start timestamp,
    absence_end timestamp,
    issue_reason text not null,

    issue_status varchar(50) not null default 'подготовлена',
    created_at timestamp not null default now(),

    constraint uq_absence_cert_number unique (certificate_number),
    constraint ck_absence_period check (
        absence_end is null or absence_start is null or absence_end >= absence_start
    )
);

-- Заявления о вступлении в РСО
create table if not exists rso_join_applications (
    application_id bigserial primary key,
    application_number varchar(50),
    application_date date not null,
    student_id bigint not null references students(student_id) on delete cascade,
    organization_id bigint references organizations(organization_id) on delete set null,

    status varchar(50) not null default 'принято',
    created_at timestamp not null default now(),

    constraint uq_rso_join_app_number unique (application_number)
);

-- Согласия на обработку персональных данных
create table if not exists personal_data_consents (
    consent_id bigserial primary key,
    consent_number varchar(50),
    consent_date date not null,
    student_id bigint not null references students(student_id) on delete cascade,
    organization_id bigint references organizations(organization_id) on delete set null,

    is_photo_video_allowed boolean not null default true,
    is_notifications_allowed boolean not null default true,

    created_at timestamp not null default now(),

    constraint uq_personal_data_consent_number unique (consent_number)
);

-- Данные, передаваемые для подготовки договора ГПХ
create table if not exists gph_contract_data (
    gph_data_id bigserial primary key,

    -- реквизиты договора
    contract_number varchar(50),
    contract_date date,

    -- текстовые поля срока, т.к. в форме они часто передаются в готовом виде
    contract_term_text varchar(255),      -- например: 10.07.2023 г. до 30.09.2024
    service_term_text varchar(255),       -- например: 10.06.2024 по 20.09.2024

    -- ссылка на студента и его банковские данные
    student_id bigint not null references students(student_id) on delete cascade,
    organization_id bigint references organizations(organization_id) on delete set null,
    bank_details_id bigint references bank_details(bank_details_id) on delete set null,

    -- представление ФИО для документа ГПХ
    full_name_nominative varchar(255),    -- ФИО
    last_name_only varchar(100),          -- Фамилия
    initials varchar(20),                 -- Инициалы
    full_name_dative varchar(255),        -- ФИО в Д.П.
    last_name_dative varchar(100),        -- Фамилия в Д.П.

    -- сумма договора
    reward_amount numeric(12,2),
    reward_amount_text varchar(500),

    -- сведения о заказчике
    customer_name varchar(255),           -- ФИО заказчика
    customer_status varchar(255),         -- его должность / статус
    customer_phone varchar(30),
    customer_email varchar(255),

    status varchar(50) not null default 'подготовлено',
    created_at timestamp not null default now(),

    constraint uq_gph_contract_number unique (contract_number),
    constraint ck_gph_reward_amount check (
        reward_amount is null or reward_amount >= 0
    )
);

-- При необходимости: отдельная фиксация уже оформленного договора ГПХ
create table if not exists gph_contracts (
    contract_id bigserial primary key,
    gph_data_id bigint not null references gph_contract_data(gph_data_id) on delete cascade,
    contract_number varchar(50),
    contract_date date,
    status varchar(50) not null default 'в работе',
    signed_at timestamp,
    notes text
);

commit;
