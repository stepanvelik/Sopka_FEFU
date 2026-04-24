import { useMemo, useState } from 'react';
import { createBankDetails, createStudent } from '../lib/api.js';
import './ParticipantRegistrationPage.css';

const instituteOptions = [
  'Восточный институт - Школа региональных и международных исследований',
  'Институт математики и компьютерных технологий',
  'Политехнический институт',
  'Школа экономики и менеджмента',
  'Юридическая школа',
  'Школа искусств и гуманитарных наук',
];

const initialFormState = {
  last_name: '',
  first_name: '',
  middle_name: '',
  birth_date: '',
  institute: '',
  study_group: '',
  phone: '',
  corporate_email: '',
  passport_series: '',
  passport_number: '',
  passport_issued_by: '',
  passport_issue_date: '',
  passport_department_code: '',
  registration_address: '',
  residential_address: '',
  snils: '',
  inn: '',
  bank_name: '',
  bik: '',
  correspondent_account: '',
  account_number: '',
};

function FormField({ label, name, value, onChange, required = false, type = 'text', placeholder = '', as = 'input', options = [] }) {
  const commonProps = {
    className: 'registration-page__control',
    id: name,
    name,
    value,
    onChange,
    required,
    placeholder,
  };

  return (
    <label className="registration-page__field" htmlFor={name}>
      <span className="registration-page__label">
        {label}
        {required ? '*' : ''}
      </span>
      {as === 'select' ? (
        <select {...commonProps}>
          <option value="">Выберите значение</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : (
        <input {...commonProps} type={type} />
      )}
    </label>
  );
}

function Section({ title, children, collapsible = false, isOpen = true, onToggle }) {
  return (
    <section className={`registration-page__section ${isOpen ? 'registration-page__section--open' : ''}`}>
      <button
        className={`registration-page__section-header ${collapsible ? 'registration-page__section-header--button' : ''}`}
        type={collapsible ? 'button' : 'button'}
        onClick={collapsible ? onToggle : undefined}
        aria-expanded={collapsible ? isOpen : true}
      >
        <span>{title}</span>
        {collapsible ? <span className="registration-page__section-icon">{isOpen ? '⌃' : '⌄'}</span> : null}
      </button>
      {isOpen ? <div className="registration-page__section-body">{children}</div> : null}
    </section>
  );
}

function sanitizeOptional(value) {
  return value.trim() === '' ? null : value.trim();
}

export function ParticipantRegistrationPage() {
  const [formData, setFormData] = useState(initialFormState);
  const [personalOpen, setPersonalOpen] = useState(true);
  const [documentsOpen, setDocumentsOpen] = useState(false);
  const [bankOpen, setBankOpen] = useState(false);
  const [status, setStatus] = useState({ type: 'idle', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = useMemo(() => {
    return (
      formData.last_name.trim() &&
      formData.first_name.trim() &&
      formData.birth_date &&
      formData.institute &&
      formData.study_group.trim()
    );
  }, [formData]);

  function handleChange(event) {
    const { name, value } = event.target;
    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setStatus({ type: 'idle', message: '' });

    const studentPayload = {
      last_name: formData.last_name.trim(),
      first_name: formData.first_name.trim(),
      middle_name: sanitizeOptional(formData.middle_name),
      birth_date: formData.birth_date,
      study_group: formData.study_group.trim(),
      institute: formData.institute,
      phone: sanitizeOptional(formData.phone),
      email: null,
      corporate_email: sanitizeOptional(formData.corporate_email),
      registration_address: sanitizeOptional(formData.registration_address),
      residential_address: sanitizeOptional(formData.residential_address),
      passport_series: sanitizeOptional(formData.passport_series),
      passport_number: sanitizeOptional(formData.passport_number),
      passport_issued_by: sanitizeOptional(formData.passport_issued_by),
      passport_issue_date: formData.passport_issue_date || null,
      passport_department_code: sanitizeOptional(formData.passport_department_code),
      snils: sanitizeOptional(formData.snils),
      inn: sanitizeOptional(formData.inn),
      rso_member_ticket_no: null,
      is_active: true,
    };

    const hasBankDetails = [formData.bank_name, formData.bik, formData.correspondent_account, formData.account_number].some(
      (value) => value.trim() !== '',
    );

    const bankPayload = {
      bank_name: formData.bank_name.trim(),
      bik: formData.bik.trim(),
      correspondent_account: sanitizeOptional(formData.correspondent_account),
      account_number: formData.account_number.trim(),
      is_active: true,
    };

    try {
      const student = await createStudent(studentPayload);

      if (hasBankDetails) {
        if (!bankPayload.bank_name || !bankPayload.bik || !bankPayload.account_number) {
          throw new Error('Для сохранения банковских реквизитов заполните наименование банка, БИК и номер счета.');
        }
        await createBankDetails(student.student_id, bankPayload);
      }

      setFormData(initialFormState);
      setPersonalOpen(true);
      setDocumentsOpen(false);
      setBankOpen(false);
      setStatus({ type: 'success', message: 'Запись успешно создана.' });
    } catch (error) {
      setStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Не удалось сохранить запись.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="registration-page">
      <div className="registration-page__hero">
        <a className="registration-page__back-link" href="#">
          На главную
        </a>
        <h1 className="registration-page__title">Регистрация</h1>
      </div>

      <form className="registration-page__form" onSubmit={handleSubmit}>
        <Section
          title="Личная информация"
          collapsible
          isOpen={personalOpen}
          onToggle={() => setPersonalOpen((current) => !current)}
        >
          <div className="registration-page__grid">
            <FormField label="Фамилия" name="last_name" value={formData.last_name} onChange={handleChange} required placeholder="Фамилия" />
            <FormField label="Имя" name="first_name" value={formData.first_name} onChange={handleChange} required placeholder="Имя" />
            <FormField label="Отчество" name="middle_name" value={formData.middle_name} onChange={handleChange} placeholder="Отчество" />
            <FormField label="Дата рождения" name="birth_date" value={formData.birth_date} onChange={handleChange} required type="date" />
            <FormField
              label="Институт"
              name="institute"
              value={formData.institute}
              onChange={handleChange}
              required
              as="select"
              options={instituteOptions}
            />
            <FormField label="Группа" name="study_group" value={formData.study_group} onChange={handleChange} required placeholder="Б9123-09.03.03цтэ" />
          </div>
        </Section>

        <Section title="Контактная информация">
          <div className="registration-page__grid">
            <FormField label="Номер телефона" name="phone" value={formData.phone} onChange={handleChange} placeholder="+7(000)000-00-00" />
            <FormField
              label="Корпоративный email"
              name="corporate_email"
              value={formData.corporate_email}
              onChange={handleChange}
              type="email"
              placeholder="name@dvfu.ru"
            />
          </div>
        </Section>

        <Section
          title="Документы"
          collapsible
          isOpen={documentsOpen}
          onToggle={() => setDocumentsOpen((current) => !current)}
        >
          <div className="registration-page__grid">
            <FormField label="Серия паспорта" name="passport_series" value={formData.passport_series} onChange={handleChange} placeholder="0000" />
            <FormField label="Номер паспорта" name="passport_number" value={formData.passport_number} onChange={handleChange} placeholder="000000" />
            <FormField label="Кем выдан" name="passport_issued_by" value={formData.passport_issued_by} onChange={handleChange} placeholder="Отделением..." />
            <FormField label="Дата выдачи" name="passport_issue_date" value={formData.passport_issue_date} onChange={handleChange} type="date" />
            <FormField
              label="Код подразделения"
              name="passport_department_code"
              value={formData.passport_department_code}
              onChange={handleChange}
              placeholder="000-000"
            />
            <FormField
              label="Адрес регистрации"
              name="registration_address"
              value={formData.registration_address}
              onChange={handleChange}
              placeholder="Адрес регистрации"
            />
            <FormField
              label="Адрес фактического проживания"
              name="residential_address"
              value={formData.residential_address}
              onChange={handleChange}
              placeholder="Адрес проживания"
            />
            <FormField label="СНИЛС" name="snils" value={formData.snils} onChange={handleChange} placeholder="000-000-000 00" />
            <FormField label="ИНН" name="inn" value={formData.inn} onChange={handleChange} placeholder="000000000000" />
          </div>
        </Section>

        <Section
          title="Банковские реквизиты"
          collapsible
          isOpen={bankOpen}
          onToggle={() => setBankOpen((current) => !current)}
        >
          <div className="registration-page__grid">
            <FormField label="Наименование банка" name="bank_name" value={formData.bank_name} onChange={handleChange} placeholder="Наименование банка" />
            <FormField label="БИК" name="bik" value={formData.bik} onChange={handleChange} placeholder="000000000" />
            <FormField
              label="Корреспондентский счет"
              name="correspondent_account"
              value={formData.correspondent_account}
              onChange={handleChange}
              placeholder="00000000000000000000"
            />
            <FormField
              label="Номер счета"
              name="account_number"
              value={formData.account_number}
              onChange={handleChange}
              placeholder="00000000000000000000"
            />
          </div>
        </Section>

        {status.message ? (
          <p className={`registration-page__status registration-page__status--${status.type}`}>{status.message}</p>
        ) : null}

        <div className="registration-page__actions">
          <button className="registration-page__submit" type="submit" disabled={!canSubmit || isSubmitting}>
            {isSubmitting ? 'Сохранение...' : 'Создать запись'}
          </button>
        </div>
      </form>
    </div>
  );
}
