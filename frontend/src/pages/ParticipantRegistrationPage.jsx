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
  corporate_email: '@dvfu.ru',
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

const fieldFormatters = {
  phone: (value) => formatPhone(value),
  birth_date: (value) => formatDate(value),
  passport_issue_date: (value) => formatDate(value),
  passport_department_code: (value) => formatDepartmentCode(value),
  snils: (value) => formatSnils(value),
  passport_series: (value) => getDigits(value).slice(0, 4),
  passport_number: (value) => getDigits(value).slice(0, 6),
  inn: (value) => getDigits(value).slice(0, 12),
  bik: (value) => getDigits(value).slice(0, 9),
  correspondent_account: (value) => getDigits(value).slice(0, 20),
  account_number: (value) => getDigits(value).slice(0, 20),
};

const digitInputProps = {
  inputMode: 'numeric',
  autoComplete: 'off',
};

const validationPatterns = {
  phone: /^\+7\(\d{3}\)\d{3}-\d{2}-\d{2}$/,
  passportSeries: /^\d{4}$/,
  passportNumber: /^\d{6}$/,
  passportDepartmentCode: /^\d{3}-\d{3}$/,
  snils: /^\d{3}-\d{3}-\d{3} \d{2}$/,
  inn: /^\d{12}$/,
  bik: /^\d{9}$/,
  bankAccount: /^\d{20}$/,
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
};

function getDigits(value) {
  return value.replace(/\D/g, '');
}

function formatPhone(value) {
  const rawDigits = getDigits(value);
  const hasCountryCode = value.startsWith('+7') || (rawDigits.length > 10 && /^[78]/.test(rawDigits));
  const digits = (hasCountryCode ? rawDigits.slice(1) : rawDigits).slice(0, 10);
  const area = digits.slice(0, 3);
  const prefix = digits.slice(3, 6);
  const firstPair = digits.slice(6, 8);
  const secondPair = digits.slice(8, 10);

  if (!digits) {
    return '';
  }

  let formatted = '+7';

  if (area) {
    formatted += `(${area}`;
    if (area.length === 3) {
      formatted += ')';
    }
  }

  if (prefix) {
    formatted += prefix;
  }

  if (firstPair) {
    formatted += `-${firstPair}`;
  }

  if (secondPair) {
    formatted += `-${secondPair}`;
  }

  return formatted;
}

function formatDate(value) {
  const digits = getDigits(value).slice(0, 8);
  const day = digits.slice(0, 2);
  const month = digits.slice(2, 4);
  const year = digits.slice(4, 8);

  return [day, month, year].filter(Boolean).join('.');
}

function toApiDate(value) {
  const match = value.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);

  if (!match) {
    return '';
  }

  const [, day, month, year] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  const isValidDate =
    date.getFullYear() === Number(year) &&
    date.getMonth() === Number(month) - 1 &&
    date.getDate() === Number(day);

  if (!isValidDate) {
    return '';
  }

  return `${year}-${month}-${day}`;
}

function formatDepartmentCode(value) {
  const digits = getDigits(value).slice(0, 6);
  const firstPart = digits.slice(0, 3);
  const secondPart = digits.slice(3, 6);

  return secondPart ? `${firstPart}-${secondPart}` : firstPart;
}

function formatSnils(value) {
  const digits = getDigits(value).slice(0, 11);
  const firstPart = digits.slice(0, 3);
  const secondPart = digits.slice(3, 6);
  const thirdPart = digits.slice(6, 9);
  const controlPart = digits.slice(9, 11);

  return [firstPart, secondPart, thirdPart].filter(Boolean).join('-') + (controlPart ? ` ${controlPart}` : '');
}

function FormField({
  label,
  name,
  value,
  onChange,
  required = false,
  type = 'text',
  placeholder = '',
  as = 'input',
  options = [],
  inputMode,
  maxLength,
  autoComplete,
  pattern,
  title,
  min,
  max,
  onInput,
}) {
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
        <input
          {...commonProps}
          type={type}
          inputMode={inputMode}
          maxLength={maxLength}
          autoComplete={autoComplete}
          pattern={pattern}
          title={title}
          min={min}
          max={max}
          onInput={onInput}
        />
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

function hasValue(value) {
  return value.trim() !== '';
}

function getValidationMessages(formData) {
  const messages = [];

  if (!hasValue(formData.last_name)) {
    messages.push('Укажите фамилию.');
  }

  if (!hasValue(formData.first_name)) {
    messages.push('Укажите имя.');
  }

  if (!hasValue(formData.birth_date)) {
    messages.push('Укажите дату рождения.');
  } else if (!toApiDate(formData.birth_date)) {
    messages.push('Дата рождения должна быть корректной и в формате 00.00.0000.');
  }

  if (!formData.institute) {
    messages.push('Выберите институт.');
  }

  if (!hasValue(formData.study_group)) {
    messages.push('Укажите группу.');
  }

  if (hasValue(formData.phone) && !validationPatterns.phone.test(formData.phone)) {
    messages.push('Телефон должен быть в формате +7(000)000-00-00.');
  }

  if (hasValue(formData.corporate_email) && !validationPatterns.email.test(formData.corporate_email)) {
    messages.push('Корпоративный email должен быть корректным адресом.');
  }

  if (hasValue(formData.passport_series) && !validationPatterns.passportSeries.test(formData.passport_series)) {
    messages.push('Серия паспорта должна состоять из 4 цифр.');
  }

  if (hasValue(formData.passport_number) && !validationPatterns.passportNumber.test(formData.passport_number)) {
    messages.push('Номер паспорта должен состоять из 6 цифр.');
  }

  if (hasValue(formData.passport_issue_date) && !toApiDate(formData.passport_issue_date)) {
    messages.push('Дата выдачи паспорта должна быть корректной и в формате 00.00.0000.');
  }

  if (
    hasValue(formData.passport_department_code) &&
    !validationPatterns.passportDepartmentCode.test(formData.passport_department_code)
  ) {
    messages.push('Код подразделения должен быть в формате 000-000.');
  }

  if (hasValue(formData.snils) && !validationPatterns.snils.test(formData.snils)) {
    messages.push('СНИЛС должен быть в формате 000-000-000 00.');
  }

  if (hasValue(formData.inn) && !validationPatterns.inn.test(formData.inn)) {
    messages.push('ИНН должен состоять из 12 цифр.');
  }

  const hasBankDetails = [formData.bank_name, formData.bik, formData.correspondent_account, formData.account_number].some(hasValue);

  if (hasBankDetails) {
    if (!hasValue(formData.bank_name)) {
      messages.push('Для банковских реквизитов укажите наименование банка.');
    }

    if (!hasValue(formData.bik)) {
      messages.push('Для банковских реквизитов укажите БИК.');
    }

    if (!hasValue(formData.account_number)) {
      messages.push('Для банковских реквизитов укажите номер счета.');
    }
  }

  if (hasValue(formData.bik) && !validationPatterns.bik.test(formData.bik)) {
    messages.push('БИК должен состоять из 9 цифр.');
  }

  if (hasValue(formData.correspondent_account) && !validationPatterns.bankAccount.test(formData.correspondent_account)) {
    messages.push('Корреспондентский счет должен состоять из 20 цифр.');
  }

  if (hasValue(formData.account_number) && !validationPatterns.bankAccount.test(formData.account_number)) {
    messages.push('Номер счета должен состоять из 20 цифр.');
  }

  return messages;
}

export function ParticipantRegistrationPage() {
  const [formData, setFormData] = useState(initialFormState);
  const [personalOpen, setPersonalOpen] = useState(true);
  const [documentsOpen, setDocumentsOpen] = useState(false);
  const [bankOpen, setBankOpen] = useState(false);
  const [status, setStatus] = useState({ type: 'idle', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validationMessages = useMemo(() => getValidationMessages(formData), [formData]);
  const canSubmit = validationMessages.length === 0;
  const feedbackMessages = status.type === 'error' && status.message ? [status.message] : validationMessages;
  const validationState = status.type === 'success' ? 'success' : feedbackMessages.length === 0 ? 'ready' : 'error';

  function handleChange(event) {
    const { name, value } = event.target;
    const nextValue = fieldFormatters[name] ? fieldFormatters[name](value) : value;

    setFormData((current) => ({
      ...current,
      [name]: nextValue,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!canSubmit) {
      setStatus({ type: 'error', message: 'Исправьте ошибки в форме перед созданием записи.' });
      return;
    }

    setIsSubmitting(true);
    setStatus({ type: 'idle', message: '' });

    const studentPayload = {
      last_name: formData.last_name.trim(),
      first_name: formData.first_name.trim(),
      middle_name: sanitizeOptional(formData.middle_name),
      birth_date: toApiDate(formData.birth_date),
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
      passport_issue_date: toApiDate(formData.passport_issue_date) || null,
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
            <FormField
              label="Дата рождения"
              name="birth_date"
              value={formData.birth_date}
              onChange={handleChange}
              required
              placeholder="00.00.0000"
              maxLength={10}
              pattern="\d{2}\.\d{2}\.\d{4}"
              title="Введите дату в формате 00.00.0000"
              {...digitInputProps}
            />
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
            <FormField
              label="Номер телефона"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="+7(000)000-00-00"
              maxLength={16}
              pattern="\+7\(\d{3}\)\d{3}-\d{2}-\d{2}"
              title="Введите 10 цифр телефона в формате +7(000)000-00-00"
              {...digitInputProps}
            />
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
            <FormField
              label="Серия паспорта"
              name="passport_series"
              value={formData.passport_series}
              onChange={handleChange}
              placeholder="0000"
              maxLength={4}
              pattern="\d{4}"
              title="Введите 4 цифры"
              {...digitInputProps}
            />
            <FormField
              label="Номер паспорта"
              name="passport_number"
              value={formData.passport_number}
              onChange={handleChange}
              placeholder="000000"
              maxLength={6}
              pattern="\d{6}"
              title="Введите 6 цифр"
              {...digitInputProps}
            />
            <FormField label="Кем выдан" name="passport_issued_by" value={formData.passport_issued_by} onChange={handleChange} placeholder="Отделением..." />
            <FormField
              label="Дата выдачи"
              name="passport_issue_date"
              value={formData.passport_issue_date}
              onChange={handleChange}
              placeholder="00.00.0000"
              maxLength={10}
              pattern="\d{2}\.\d{2}\.\d{4}"
              title="Введите дату в формате 00.00.0000"
              {...digitInputProps}
            />
            <FormField
              label="Код подразделения"
              name="passport_department_code"
              value={formData.passport_department_code}
              onChange={handleChange}
              placeholder="000-000"
              maxLength={7}
              pattern="\d{3}-\d{3}"
              title="Введите 6 цифр в формате 000-000"
              {...digitInputProps}
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
            <FormField
              label="СНИЛС"
              name="snils"
              value={formData.snils}
              onChange={handleChange}
              placeholder="000-000-000 00"
              maxLength={14}
              pattern="\d{3}-\d{3}-\d{3} \d{2}"
              title="Введите 11 цифр СНИЛС"
              {...digitInputProps}
            />
            <FormField
              label="ИНН"
              name="inn"
              value={formData.inn}
              onChange={handleChange}
              placeholder="000000000000"
              maxLength={12}
              pattern="\d{12}"
              title="Введите 12 цифр"
              {...digitInputProps}
            />
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
            <FormField
              label="БИК"
              name="bik"
              value={formData.bik}
              onChange={handleChange}
              placeholder="000000000"
              maxLength={9}
              pattern="\d{9}"
              title="Введите 9 цифр"
              {...digitInputProps}
            />
            <FormField
              label="Корреспондентский счет"
              name="correspondent_account"
              value={formData.correspondent_account}
              onChange={handleChange}
              placeholder="00000000000000000000"
              maxLength={20}
              pattern="\d{20}"
              title="Введите 20 цифр"
              {...digitInputProps}
            />
            <FormField
              label="Номер счета"
              name="account_number"
              value={formData.account_number}
              onChange={handleChange}
              placeholder="00000000000000000000"
              maxLength={20}
              pattern="\d{20}"
              title="Введите 20 цифр"
              {...digitInputProps}
            />
          </div>
        </Section>

        <div className="registration-page__actions">
          <div
            className={`registration-page__validation registration-page__validation--${validationState}`}
            aria-live="polite"
          >
            <span className="registration-page__validation-title">
              {status.type === 'success' ? 'Запись создана' : feedbackMessages.length === 0 ? 'Можно создать запись' : 'Что нужно исправить'}
            </span>
            {status.type === 'success' ? (
              <p className="registration-page__validation-text">{status.message}</p>
            ) : feedbackMessages.length === 0 ? (
              <p className="registration-page__validation-text">Все обязательные данные заполнены.</p>
            ) : (
              <ul className="registration-page__validation-list">
                {feedbackMessages.slice(0, 4).map((message) => (
                  <li key={message}>{message}</li>
                ))}
                {feedbackMessages.length > 4 ? <li>И еще: {feedbackMessages.length - 4}</li> : null}
              </ul>
            )}
          </div>
          <button className="registration-page__submit" type="submit" disabled={!canSubmit || isSubmitting}>
            {isSubmitting ? 'Сохранение...' : 'Создать запись'}
          </button>
        </div>
      </form>
    </div>
  );
}
