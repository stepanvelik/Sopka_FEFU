import { useEffect, useMemo, useRef, useState } from 'react';
import { PageHeader } from '../components/ui/PageHeader.jsx';
import {
  createBankDetails,
  downloadEmploymentBankDetailsExcel,
  downloadEmploymentDocumentsArchive,
  listBankDetails,
  listStudents,
  updateBankDetails,
  updateStudent,
} from '../lib/api.js';
import { formatPhone, getStudentFullName } from '../lib/participantUtils.js';
import './DocumentsSpravkiPage.css';

const digitInputProps = {
  inputMode: 'numeric',
  autoComplete: 'off',
};

const fieldFormatters = {
  passport_series: (value) => getDigits(value).slice(0, 4),
  passport_number: (value) => getDigits(value).slice(0, 6),
  passport_department_code: (value) => formatDepartmentCode(value),
  snils: (value) => formatSnils(value),
  inn: (value) => getDigits(value).slice(0, 12),
  bik: (value) => getDigits(value).slice(0, 9),
  correspondent_account: (value) => getDigits(value).slice(0, 20),
  account_number: (value) => getDigits(value).slice(0, 20),
};

const archiveOptions = [
  { id: 'all', label: 'Все документы' },
  { id: 'file_1', label: 'Заявление на вступление' },
  { id: 'file_2', label: 'Согласие ОПД' },
  { id: 'file_3', label: 'Реквизиты' },
];

const STUDENTS_PAGE_SIZE = 200;

function getDigits(value) {
  return String(value ?? '').replace(/\D/g, '');
}

function formatSnils(value) {
  const digits = getDigits(value).slice(0, 11);
  const firstPart = digits.slice(0, 3);
  const secondPart = digits.slice(3, 6);
  const thirdPart = digits.slice(6, 9);
  const controlPart = digits.slice(9, 11);
  return [firstPart, secondPart, thirdPart].filter(Boolean).join('-') + (controlPart ? ` ${controlPart}` : '');
}

function formatDepartmentCode(value) {
  const digits = getDigits(value).slice(0, 6);
  const firstPart = digits.slice(0, 3);
  const secondPart = digits.slice(3, 6);
  return secondPart ? `${firstPart}-${secondPart}` : firstPart;
}

function normalizeSearchValue(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('ru-RU');
}

function formatDate(value) {
  if (!value) return '';
  return String(value).slice(0, 10);
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function sanitizeOptional(value) {
  const trimmed = String(value || '').replace(/\s+/g, ' ').trim();
  return trimmed === '' ? null : trimmed;
}

function sanitizeRequired(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function hasValue(value) {
  return String(value || '').trim() !== '';
}

function hasCompleteBankDetails(bankDetails) {
  return Boolean(
    bankDetails
      && hasValue(bankDetails.bank_name)
      && hasValue(bankDetails.bik)
      && hasValue(bankDetails.account_number),
  );
}

function hasCompletePassportData(student) {
  return Boolean(
    hasValue(student?.passport_series)
      && hasValue(student?.passport_number)
      && hasValue(student?.passport_issued_by)
      && hasValue(student?.passport_issue_date)
      && hasValue(student?.passport_department_code)
      && hasValue(student?.registration_address),
  );
}

function getMissingFields(student, bankDetails) {
  const missing = [];
  if (!hasCompletePassportData(student)) missing.push('Паспортные данные');
  if (!hasValue(student.snils) || !hasValue(student.inn)) missing.push('ИНН / СНИЛС');
  if (!hasCompleteBankDetails(bankDetails)) missing.push('Банковские реквизиты');
  return missing;
}

function compareStudentsByFullName(left, right) {
  return getStudentFullName(left).localeCompare(getStudentFullName(right), 'ru-RU')
    || Number(left.student_id) - Number(right.student_id);
}

function studentMatchesRegistrationDate(student, dateFrom, dateTo) {
  const createdAt = formatDate(student.created_at);
  if (!createdAt) return true;
  if (dateFrom && createdAt < dateFrom) return false;
  if (dateTo && createdAt > dateTo) return false;
  return true;
}

function createDraft(student, bankDetails) {
  return {
    passport_series: student.passport_series || '',
    passport_number: student.passport_number || '',
    passport_issued_by: student.passport_issued_by || '',
    passport_issue_date: formatDate(student.passport_issue_date),
    passport_department_code: student.passport_department_code || '',
    registration_address: student.registration_address || '',
    snils: student.snils || '',
    inn: student.inn || '',
    bank_name: bankDetails?.bank_name || '',
    bik: bankDetails?.bik || '',
    correspondent_account: bankDetails?.correspondent_account || '',
    account_number: bankDetails?.account_number || '',
  };
}

async function loadAllActiveStudents() {
  const rows = [];
  let skip = 0;
  let hasMore = true;

  while (hasMore) {
    const page = await listStudents({ skip, limit: STUDENTS_PAGE_SIZE, isActive: true });
    const pageRows = page || [];
    rows.push(...pageRows);
    hasMore = pageRows.length === STUDENTS_PAGE_SIZE;
    skip += STUDENTS_PAGE_SIZE;
  }

  return rows;
}

function getValidationMessages(draft, options = {}) {
  const {
    validatePassport = true,
    validateInn = true,
    validateBank = true,
  } = options;
  const messages = [];
  if (validatePassport) {
    if (!hasValue(draft.passport_series)) messages.push('Укажите серию паспорта.');
    if (!hasValue(draft.passport_number)) messages.push('Укажите номер паспорта.');
    if (!hasValue(draft.passport_issued_by)) messages.push('Укажите кем выдан паспорт.');
    if (!hasValue(draft.passport_issue_date)) messages.push('Укажите дату выдачи паспорта.');
    if (!hasValue(draft.passport_department_code)) messages.push('Укажите код подразделения.');
    if (!hasValue(draft.registration_address)) messages.push('Укажите адрес регистрации.');
  }
  if (validatePassport && hasValue(draft.passport_series) && !/^\d{4}$/.test(draft.passport_series)) {
    messages.push('Серия паспорта должна состоять из 4 цифр.');
  }
  if (validatePassport && hasValue(draft.passport_number) && !/^\d{6}$/.test(draft.passport_number)) {
    messages.push('Номер паспорта должен состоять из 6 цифр.');
  }
  if (validatePassport && hasValue(draft.passport_department_code) && !/^\d{3}-\d{3}$/.test(draft.passport_department_code)) {
    messages.push('Код подразделения должен быть в формате 000-000.');
  }
  if (validateInn && hasValue(draft.inn) && !/^\d{12}$/.test(draft.inn)) {
    messages.push('ИНН должен состоять из 12 цифр.');
  }

  const hasAnyBankDetails = [draft.bank_name, draft.bik, draft.correspondent_account, draft.account_number].some(hasValue);
  if (validateBank && hasAnyBankDetails) {
    if (!hasValue(draft.bank_name)) messages.push('Укажите наименование банка.');
    if (!hasValue(draft.bik)) messages.push('Укажите БИК.');
    if (!hasValue(draft.account_number)) messages.push('Укажите номер счета.');
  }
  if (validateBank && hasValue(draft.bik) && !/^\d{9}$/.test(draft.bik)) {
    messages.push('БИК должен состоять из 9 цифр.');
  }
  if (validateBank && hasValue(draft.correspondent_account) && !/^\d{20}$/.test(draft.correspondent_account)) {
    messages.push('Корреспондентский счет должен состоять из 20 цифр.');
  }
  if (validateBank && hasValue(draft.account_number) && !/^\d{20}$/.test(draft.account_number)) {
    messages.push('Номер счета должен состоять из 20 цифр.');
  }
  return messages;
}

function ParticipantDocumentsRow({
  student,
  bankDetails,
  draft,
  isSelected,
  isSaving,
  onChangeDraft,
  onSave,
  onToggle,
}) {
  const fullName = getStudentFullName(student) || `ID ${student.student_id}`;
  const missingFields = getMissingFields(student, bankDetails);
  const hasMissingFields = missingFields.length > 0;
  const validationMessages = getValidationMessages(draft, {
    validatePassport: !hasCompletePassportData(student),
    validateInn: !hasValue(student.inn),
    validateBank: !hasCompleteBankDetails(bankDetails),
  });
  const canSave = validationMessages.length === 0 && !isSaving;

  function handleChange(event) {
    const { name, value } = event.target;
    const nextValue = fieldFormatters[name] ? fieldFormatters[name](value) : value;
    onChangeDraft(student.student_id, name, nextValue);
  }

  function getFieldClassName(name, sourceValue) {
    return !hasValue(sourceValue) && !hasValue(draft[name])
      ? 'documents-spravki-page__missing-input'
      : '';
  }

  return (
    <>
      <tr className={hasMissingFields ? 'documents-spravki-page__row--incomplete' : 'documents-spravki-page__row--complete'}>
        <td className="documents-spravki-page__select-cell">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggle(student.student_id)}
            aria-label={`Выбрать ${fullName}`}
          />
        </td>
        <td>
          <a className="documents-spravki-page__participant-link" href={`#edit-participant?id=${student.student_id}`}>
            {fullName}
          </a>
          <span className="documents-spravki-page__registered">
            Регистрация: {formatDate(student.created_at) || 'не указана'}
          </span>
        </td>
        <td>{formatPhone(student.phone) || 'Не указан'}</td>
        <td>
          {hasMissingFields ? (
            <div className="documents-spravki-page__missing-list">
              {missingFields.map((field) => (
                <span key={field}>• {field}</span>
              ))}
            </div>
          ) : (
            <span className="documents-spravki-page__dash">—</span>
          )}
        </td>
      </tr>
      {hasMissingFields ? (
        <tr className="documents-spravki-page__details-row">
          <td />
          <td colSpan="3">
            <div className="documents-spravki-page__details-grid">
              <section className="documents-spravki-page__details-box">
                <h2>Паспортные данные</h2>
                <div className="documents-spravki-page__inline-form">
                  <label>
                    <span>Серия</span>
                    <input className={getFieldClassName('passport_series', student.passport_series)} name="passport_series" value={draft.passport_series} onChange={handleChange} placeholder="0000" maxLength={4} {...digitInputProps} />
                  </label>
                  <label>
                    <span>Номер</span>
                    <input className={getFieldClassName('passport_number', student.passport_number)} name="passport_number" value={draft.passport_number} onChange={handleChange} placeholder="000000" maxLength={6} {...digitInputProps} />
                  </label>
                  <label>
                    <span>Кем выдан</span>
                    <input className={getFieldClassName('passport_issued_by', student.passport_issued_by)} name="passport_issued_by" value={draft.passport_issued_by} onChange={handleChange} placeholder="Кем выдан паспорт" />
                  </label>
                  <label>
                    <span>Дата выдачи</span>
                    <input className={getFieldClassName('passport_issue_date', student.passport_issue_date)} name="passport_issue_date" type="date" value={draft.passport_issue_date} onChange={handleChange} />
                  </label>
                  <label>
                    <span>Код подразделения</span>
                    <input className={getFieldClassName('passport_department_code', student.passport_department_code)} name="passport_department_code" value={draft.passport_department_code} onChange={handleChange} placeholder="000-000" maxLength={7} {...digitInputProps} />
                  </label>
                  <label>
                    <span>Адрес регистрации</span>
                    <input className={getFieldClassName('registration_address', student.registration_address)} name="registration_address" value={draft.registration_address} onChange={handleChange} placeholder="Адрес регистрации" />
                  </label>
                </div>
              </section>

              <section className="documents-spravki-page__details-box">
                <h2>ИНН / СНИЛС</h2>
                <div className="documents-spravki-page__inline-form">
                  <label>
                    <span>СНИЛС</span>
                    <input
                      name="snils"
                      className={getFieldClassName('snils', student.snils)}
                      value={draft.snils}
                      onChange={handleChange}
                      placeholder="000-000-000 00"
                      maxLength={14}
                      {...digitInputProps}
                    />
                  </label>
                  <label>
                    <span>ИНН</span>
                    <input
                      name="inn"
                      className={getFieldClassName('inn', student.inn)}
                      value={draft.inn}
                      onChange={handleChange}
                      placeholder="000000000000"
                      maxLength={12}
                      {...digitInputProps}
                    />
                  </label>
                </div>
              </section>

              <section className="documents-spravki-page__details-box">
                <h2>Банковские реквизиты</h2>
                <div className="documents-spravki-page__inline-form">
                  <label>
                    <span>Банк</span>
                    <input className={getFieldClassName('bank_name', bankDetails?.bank_name)} name="bank_name" value={draft.bank_name} onChange={handleChange} placeholder="Наименование банка" />
                  </label>
                  <label>
                    <span>БИК</span>
                    <input className={getFieldClassName('bik', bankDetails?.bik)} name="bik" value={draft.bik} onChange={handleChange} placeholder="000000000" maxLength={9} {...digitInputProps} />
                  </label>
                  <label>
                    <span>Корр. счет</span>
                    <input
                      name="correspondent_account"
                      className={getFieldClassName('correspondent_account', bankDetails?.correspondent_account)}
                      value={draft.correspondent_account}
                      onChange={handleChange}
                      placeholder="00000000000000000000"
                      maxLength={20}
                      {...digitInputProps}
                    />
                  </label>
                  <label>
                    <span>Счет</span>
                    <input
                      name="account_number"
                      className={getFieldClassName('account_number', bankDetails?.account_number)}
                      value={draft.account_number}
                      onChange={handleChange}
                      placeholder="00000000000000000000"
                      maxLength={20}
                      {...digitInputProps}
                    />
                  </label>
                </div>
              </section>
            </div>

            <div className="documents-spravki-page__details-actions">
              {validationMessages.length ? (
                <p className="documents-spravki-page__row-error">{validationMessages[0]}</p>
              ) : null}
              <button type="button" disabled={!canSave} onClick={() => onSave(student.student_id)}>
                {isSaving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

export function DocumentsSpravkiPage() {
  const [students, setStudents] = useState([]);
  const [bankDetailsByStudentId, setBankDetailsByStudentId] = useState({});
  const [draftsByStudentId, setDraftsByStudentId] = useState({});
  const [selectedIds, setSelectedIds] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedOnly, setSelectedOnly] = useState(false);
  const [archiveOption, setArchiveOption] = useState('all');
  const [openArchiveMenu, setOpenArchiveMenu] = useState(false);
  const archiveMenuRef = useRef(null);
  const [savingStudentId, setSavingStudentId] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [status, setStatus] = useState({ type: 'loading', message: 'Загрузка участников...' });

  useEffect(() => {
    if (!openArchiveMenu) {
      return undefined;
    }

    function handleDocumentClick(event) {
      if (archiveMenuRef.current && !archiveMenuRef.current.contains(event.target)) {
        setOpenArchiveMenu(false);
      }
    }

    document.addEventListener('mousedown', handleDocumentClick);
    return () => document.removeEventListener('mousedown', handleDocumentClick);
  }, [openArchiveMenu]);

  useEffect(() => {
    let isMounted = true;

    loadAllActiveStudents()
      .then(async (rows) => {
        const sortedStudents = [...(rows || [])].sort(compareStudentsByFullName);
        const bankRows = await Promise.all(
          sortedStudents.map((student) => listBankDetails(student.student_id, { activeOnly: true }).catch(() => [])),
        );

        if (!isMounted) return;

        const nextBankDetails = {};
        const nextDrafts = {};
        sortedStudents.forEach((student, index) => {
          const primaryBankDetails = bankRows[index]?.[0] || null;
          nextBankDetails[student.student_id] = primaryBankDetails;
          nextDrafts[student.student_id] = createDraft(student, primaryBankDetails);
        });

        setStudents(sortedStudents);
        setBankDetailsByStudentId(nextBankDetails);
        setDraftsByStudentId(nextDrafts);
        setStatus({ type: 'idle', message: '' });
      })
      .catch((error) => {
        if (!isMounted) return;
        setStatus({
          type: 'error',
          message: error instanceof Error ? error.message : 'Не удалось загрузить участников.',
        });
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredStudents = useMemo(() => {
    const normalizedQuery = normalizeSearchValue(searchQuery);

    return students.filter((student) => {
      const fullName = normalizeSearchValue(getStudentFullName(student));
      const phone = normalizeSearchValue(formatPhone(student.phone));
      const rawPhone = normalizeSearchValue(student.phone);
      const searchMatches = !normalizedQuery
        || fullName.includes(normalizedQuery)
        || phone.includes(normalizedQuery)
        || rawPhone.includes(normalizedQuery);
      const dateMatches = studentMatchesRegistrationDate(student, dateFrom, dateTo);
      const selectedMatches = !selectedOnly || selectedIds.includes(student.student_id);
      return searchMatches && dateMatches && selectedMatches;
    });
  }, [dateFrom, dateTo, searchQuery, selectedIds, selectedOnly, students]);

  const selectedVisibleIds = filteredStudents
    .map((student) => student.student_id)
    .filter((studentId) => selectedIds.includes(studentId));
  const allVisibleSelected = filteredStudents.length > 0 && selectedVisibleIds.length === filteredStudents.length;
  const selectedStudentsCount = selectedIds.length;

  function handleDraftChange(studentId, name, value) {
    setDraftsByStudentId((current) => ({
      ...current,
      [studentId]: {
        ...(current[studentId] || {}),
        [name]: value,
      },
    }));
  }

  function toggleParticipant(studentId) {
    setSelectedIds((current) => (
      current.includes(studentId)
        ? current.filter((item) => item !== studentId)
        : [...current, studentId]
    ));
  }

  function selectAllVisible() {
    setSelectedIds((current) => {
      const next = new Set(current);
      filteredStudents.forEach((student) => next.add(student.student_id));
      return [...next];
    });
  }

  function toggleAllVisible() {
    if (allVisibleSelected) {
      const visible = new Set(filteredStudents.map((student) => student.student_id));
      setSelectedIds((current) => current.filter((studentId) => !visible.has(studentId)));
      return;
    }
    selectAllVisible();
  }

  async function handleSaveStudent(studentId) {
    const student = students.find((item) => item.student_id === studentId);
    const bankDetails = bankDetailsByStudentId[studentId] || null;
    const draft = draftsByStudentId[studentId] || {};
    const validationMessages = getValidationMessages(draft, {
      validatePassport: !hasCompletePassportData(student),
      validateInn: !hasValue(student?.inn),
      validateBank: !hasCompleteBankDetails(bankDetails),
    });

    if (!student || validationMessages.length) {
      setStatus({ type: 'error', message: validationMessages[0] || 'Не удалось найти участника.' });
      return;
    }

    setSavingStudentId(studentId);
    setStatus({ type: 'idle', message: '' });

    try {
      const studentPayload = {};
      if (!hasCompletePassportData(student)) {
        studentPayload.passport_series = sanitizeOptional(draft.passport_series);
        studentPayload.passport_number = sanitizeOptional(draft.passport_number);
        studentPayload.passport_issued_by = sanitizeOptional(draft.passport_issued_by);
        studentPayload.passport_issue_date = sanitizeOptional(draft.passport_issue_date);
        studentPayload.passport_department_code = sanitizeOptional(draft.passport_department_code);
        studentPayload.registration_address = sanitizeOptional(draft.registration_address);
      }
      if (!hasValue(student.snils)) studentPayload.snils = sanitizeOptional(draft.snils);
      if (!hasValue(student.inn)) studentPayload.inn = sanitizeOptional(draft.inn);

      let nextStudent = student;
      if (Object.keys(studentPayload).length) {
        nextStudent = await updateStudent(studentId, studentPayload);
      }

      let nextBankDetails = bankDetails;
      const shouldSaveBank = !hasCompleteBankDetails(bankDetails)
        && [draft.bank_name, draft.bik, draft.correspondent_account, draft.account_number].some(hasValue);

      if (shouldSaveBank) {
        const bankPayload = {
          bank_name: sanitizeRequired(draft.bank_name),
          bik: sanitizeRequired(draft.bik),
          correspondent_account: sanitizeOptional(draft.correspondent_account),
          account_number: sanitizeRequired(draft.account_number),
          is_active: true,
        };
        nextBankDetails = bankDetails?.bank_details_id
          ? await updateBankDetails(bankDetails.bank_details_id, bankPayload)
          : await createBankDetails(studentId, bankPayload);
      }

      setStudents((current) => current.map((item) => (item.student_id === studentId ? nextStudent : item)));
      setBankDetailsByStudentId((current) => ({ ...current, [studentId]: nextBankDetails }));
      setDraftsByStudentId((current) => ({ ...current, [studentId]: createDraft(nextStudent, nextBankDetails) }));
      setStatus({ type: 'idle', message: 'Данные участника сохранены.' });
    } catch (error) {
      setStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Не удалось сохранить данные участника.',
      });
    } finally {
      setSavingStudentId(null);
    }
  }

  function getExportStudentIds() {
    return selectedIds;
  }

  async function handleDownloadBankExcel() {
    if (selectedIds.length === 0) {
      setStatus({ type: 'error', message: 'Выберите участников для формирования Excel файла.' });
      return;
    }

    setIsDownloading(true);
    setStatus({ type: 'loading', message: 'Формирование архива с Excel файлами по выбранным участникам...' });

    try {
      const { blob, filename } = await downloadEmploymentBankDetailsExcel({
        studentIds: getExportStudentIds(),
      });
      triggerDownload(blob, filename);
      setStatus({ type: 'idle', message: 'Архив с Excel файлами по участникам сформирован и загружен.' });
    } catch (error) {
      setStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Не удалось сформировать Excel файл с банковскими реквизитами.',
      });
    } finally {
      setIsDownloading(false);
    }
  }

  const selectedArchiveLabel = useMemo(
    () => archiveOptions.find((option) => option.id === archiveOption)?.label || 'документами',
    [archiveOption],
  );

  function handleSelectArchiveOption(optionId) {
    setArchiveOption(optionId);
    setOpenArchiveMenu(false);
    const label = archiveOptions.find((option) => option.id === optionId)?.label;
    if (label) {
      setStatus({ type: 'idle', message: `Выбран документ: ${label}.` });
    }
  }

  async function handleDownloadArchive(optionId = archiveOption) {
    if (selectedIds.length === 0) {
      setStatus({ type: 'error', message: 'Выберите участников для формирования архива.' });
      return;
    }

    setOpenArchiveMenu(false);
    setArchiveOption(optionId);
    setIsDownloading(true);
    setStatus({ type: 'loading', message: 'Формирование архива с документами...' });

    try {
      const { blob, filename } = await downloadEmploymentDocumentsArchive({
        studentIds: getExportStudentIds(),
        file: optionId === 'all' ? '' : optionId,
      });
      triggerDownload(blob, filename);
      const successMessage = optionId === 'all'
        ? 'Архив сформирован: заявление на вступление, согласие ОПД и реквизиты.'
        : 'Архив с документами сформирован и загружен.';
      setStatus({ type: 'idle', message: successMessage });
    } catch (error) {
      setStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Не удалось сформировать архив с документами.',
      });
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <div className="documents-spravki-page">
      <PageHeader title="Формирование документов на трудоустройство для участников" />

      <section className="documents-spravki-page__panel">
        <div className="documents-spravki-page__controls">
          <label className="documents-spravki-page__field documents-spravki-page__field--search">
            <span>Участники</span>
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Выберите участника"
            />
          </label>

          <label className="documents-spravki-page__field">
            <span>Дата регистрации с</span>
            <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
          </label>

          <label className="documents-spravki-page__field">
            <span>Дата регистрации по</span>
            <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
          </label>
        </div>

        <div className="documents-spravki-page__actions">
          <div className="documents-spravki-page__selection-actions">
            <label className="documents-spravki-page__checkbox">
              <input
                type="checkbox"
                checked={selectedOnly}
                onChange={(event) => setSelectedOnly(event.target.checked)}
              />
              <span>Только выбранные участники</span>
            </label>
            <button
              type="button"
              className="documents-spravki-page__secondary-button"
              disabled={filteredStudents.length === 0}
              onClick={selectAllVisible}
            >
              Выбрать всех
            </button>
          </div>

          <div className="documents-spravki-page__download-actions">
            <span className="documents-spravki-page__selected-count">
              Выбрано участников: {selectedStudentsCount}
            </span>
            <button
              type="button"
              className="documents-spravki-page__download"
              disabled={selectedStudentsCount === 0 || isDownloading}
              onClick={handleDownloadBankExcel}
            >
              Сформировать EXCEL файл с банк. рек-тами
            </button>

            <div className="documents-spravki-page__split-action" ref={archiveMenuRef}>
              <button
                type="button"
                className="documents-spravki-page__download"
                disabled={selectedStudentsCount === 0 || isDownloading}
                onClick={() => handleDownloadArchive(archiveOption)}
              >
                Сформировать архив: {selectedArchiveLabel}
              </button>
              <button
                type="button"
                className="documents-spravki-page__menu-button"
                disabled={isDownloading}
                onClick={() => setOpenArchiveMenu((current) => !current)}
                aria-label="Выбрать тип документа"
                aria-expanded={openArchiveMenu}
                aria-haspopup="menu"
              >
                ▾
              </button>
              {openArchiveMenu ? (
                <div className="documents-spravki-page__menu" role="menu">
                  {archiveOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      role="menuitem"
                      className={option.id === archiveOption ? 'is-selected' : ''}
                      onClick={() => handleSelectArchiveOption(option.id)}
                    >

                      {option.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {status.message ? (
          <p className={`documents-spravki-page__status documents-spravki-page__status--${status.type}`}>
            {status.message}
          </p>
        ) : null}
      </section>

      <section className="documents-spravki-page__table-frame">
        <table className="documents-spravki-page__table">
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleAllVisible}
                  disabled={filteredStudents.length === 0}
                  aria-label="Выбрать всех видимых участников"
                />
              </th>
              <th>ФИО</th>
              <th>Телефон</th>
              <th>Незаполненная информация</th>
            </tr>
          </thead>
          <tbody>
            {status.type === 'loading' && students.length === 0 ? (
              <tr>
                <td colSpan="4" className="documents-spravki-page__empty">Загрузка участников...</td>
              </tr>
            ) : filteredStudents.length === 0 ? (
              <tr>
                <td colSpan="4" className="documents-spravki-page__empty">Участники по выбранным условиям не найдены.</td>
              </tr>
            ) : (
              filteredStudents.map((student) => (
                <ParticipantDocumentsRow
                  key={student.student_id}
                  student={student}
                  bankDetails={bankDetailsByStudentId[student.student_id]}
                  draft={draftsByStudentId[student.student_id] || createDraft(student, bankDetailsByStudentId[student.student_id])}
                  isSelected={selectedIds.includes(student.student_id)}
                  isSaving={savingStudentId === student.student_id}
                  onChangeDraft={handleDraftChange}
                  onSave={handleSaveStudent}
                  onToggle={toggleParticipant}
                />
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
