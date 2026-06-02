import { useEffect, useMemo, useState } from 'react';
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
  snils: (value) => formatSnils(value),
  inn: (value) => getDigits(value).slice(0, 12),
  bik: (value) => getDigits(value).slice(0, 9),
  correspondent_account: (value) => getDigits(value).slice(0, 20),
  account_number: (value) => getDigits(value).slice(0, 20),
};

const archiveOptions = [
  { id: 'all', label: 'Все файлы' },
  { id: 'file_1', label: 'Только файл 1' },
  { id: 'file_2', label: 'Только файл 2' },
  { id: 'file_3', label: 'Только файл 3' },
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
  const trimmed = String(value || '').trim();
  return trimmed === '' ? null : trimmed;
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

function getMissingFields(student, bankDetails) {
  const missing = [];
  if (!hasValue(student.snils)) missing.push('СНИЛС');
  if (!hasValue(student.inn)) missing.push('ИНН');
  if (!hasCompleteBankDetails(bankDetails)) missing.push('Банк. реквизиты');
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
    validateInn = true,
    validateBank = true,
  } = options;
  const messages = [];
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
  const validationMessages = getValidationMessages(draft, {
    validateInn: !hasValue(student.inn),
    validateBank: !hasCompleteBankDetails(bankDetails),
  });
  const canSave = validationMessages.length === 0 && !isSaving;

  function handleChange(event) {
    const { name, value } = event.target;
    const nextValue = fieldFormatters[name] ? fieldFormatters[name](value) : value;
    onChangeDraft(student.student_id, name, nextValue);
  }

  return (
    <tr className={missingFields.length ? 'documents-spravki-page__row--incomplete' : 'documents-spravki-page__row--complete'}>
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
        {missingFields.length ? (
          <div className="documents-spravki-page__missing-list">
            {missingFields.map((field) => (
              <span key={field}>• {field}</span>
            ))}
          </div>
        ) : null}
      </td>
      <td>
        <div className="documents-spravki-page__inline-form">
          {!hasValue(student.snils) ? (
            <label>
              <span>СНИЛС</span>
              <input
                name="snils"
                value={draft.snils}
                onChange={handleChange}
                placeholder="000-000-000 00"
                maxLength={14}
                {...digitInputProps}
              />
            </label>
          ) : null}

          {!hasValue(student.inn) ? (
            <label>
              <span>ИНН</span>
              <input
                name="inn"
                value={draft.inn}
                onChange={handleChange}
                placeholder="000000000000"
                maxLength={12}
                {...digitInputProps}
              />
            </label>
          ) : null}

          {!hasCompleteBankDetails(bankDetails) ? (
            <>
              <label>
                <span>Банк</span>
                <input name="bank_name" value={draft.bank_name} onChange={handleChange} placeholder="Наименование банка" />
              </label>
              <label>
                <span>БИК</span>
                <input name="bik" value={draft.bik} onChange={handleChange} placeholder="000000000" maxLength={9} {...digitInputProps} />
              </label>
              <label>
                <span>Корр. счет</span>
                <input
                  name="correspondent_account"
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
                  value={draft.account_number}
                  onChange={handleChange}
                  placeholder="00000000000000000000"
                  maxLength={20}
                  {...digitInputProps}
                />
              </label>
            </>
          ) : null}

          {missingFields.length ? (
            <button type="button" disabled={!canSave} onClick={() => onSave(student.student_id)}>
              {isSaving ? 'Сохранение...' : 'Сохранить'}
            </button>
          ) : null}
        </div>
        {validationMessages.length ? (
          <p className="documents-spravki-page__row-error">{validationMessages[0]}</p>
        ) : null}
      </td>
    </tr>
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
  const [savingStudentId, setSavingStudentId] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [status, setStatus] = useState({ type: 'loading', message: 'Загрузка участников...' });

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
          bank_name: draft.bank_name.trim(),
          bik: draft.bik.trim(),
          correspondent_account: sanitizeOptional(draft.correspondent_account),
          account_number: draft.account_number.trim(),
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
      setStatus({ type: 'error', message: 'Выберите участников для формирования файла.' });
      return;
    }

    setIsDownloading(true);
    setStatus({ type: 'loading', message: 'Формирование Excel файла...' });

    try {
      const { blob, filename } = await downloadEmploymentBankDetailsExcel({ studentIds: getExportStudentIds() });
      triggerDownload(blob, filename);
      setStatus({ type: 'idle', message: 'Excel файл сформирован и загружен.' });
    } catch (error) {
      setStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Не удалось сформировать Excel файл.',
      });
    } finally {
      setIsDownloading(false);
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
      setStatus({ type: 'idle', message: 'Архив с документами сформирован и загружен.' });
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
            <span>С даты</span>
            <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
          </label>

          <label className="documents-spravki-page__field">
            <span>По дату</span>
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
            <button
              type="button"
              className="documents-spravki-page__download"
              disabled={selectedStudentsCount === 0 || isDownloading}
              onClick={handleDownloadBankExcel}
            >
              Сформировать EXCEL файл с банк. рек-тами
            </button>

            <div className="documents-spravki-page__split-action">
              <button
                type="button"
                className="documents-spravki-page__download"
                disabled={selectedStudentsCount === 0 || isDownloading}
                onClick={() => handleDownloadArchive(archiveOption)}
              >
                Сформировать архив с документами
              </button>
              <button
                type="button"
                className="documents-spravki-page__menu-button"
                disabled={selectedStudentsCount === 0 || isDownloading}
                onClick={() => setOpenArchiveMenu((current) => !current)}
                aria-label="Выбрать состав архива"
                aria-expanded={openArchiveMenu}
              >
                ▾
              </button>
              {openArchiveMenu ? (
                <div className="documents-spravki-page__menu">
                  {archiveOptions.slice(1).map((option) => (
                    <button key={option.id} type="button" onClick={() => handleDownloadArchive(option.id)}>
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
              <th>Заполнить данные</th>
            </tr>
          </thead>
          <tbody>
            {status.type === 'loading' && students.length === 0 ? (
              <tr>
                <td colSpan="5" className="documents-spravki-page__empty">Загрузка участников...</td>
              </tr>
            ) : filteredStudents.length === 0 ? (
              <tr>
                <td colSpan="5" className="documents-spravki-page__empty">Участники по выбранным условиям не найдены.</td>
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
