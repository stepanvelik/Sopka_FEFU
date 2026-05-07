import { useEffect, useMemo, useState } from 'react';
import { listBankDetails, listStudents } from '../lib/api.js';
import './ParticipantsDatabasePage.css';

const PAGE_SIZE = 15;

const studentFieldGroups = [
  {
    title: 'Учебные данные',
    fields: [
      ['Институт', 'institute'],
      ['Группа', 'study_group'],
      ['Активен', 'is_active', (value) => (value ? 'Да' : 'Нет')],
    ],
  },
  {
    title: 'Контакты',
    fields: [
      ['Телефон', 'phone'],
      ['Email', 'email'],
      ['Корпоративный email', 'corporate_email'],
      ['Адрес регистрации', 'registration_address'],
      ['Адрес проживания', 'residential_address'],
    ],
  },
  {
    title: 'Документы',
    fields: [
      ['Серия паспорта', 'passport_series'],
      ['Номер паспорта', 'passport_number'],
      ['Кем выдан', 'passport_issued_by'],
      ['Дата выдачи', 'passport_issue_date', formatDate],
      ['Код подразделения', 'passport_department_code'],
      ['СНИЛС', 'snils'],
      ['ИНН', 'inn'],
      ['Билет РСО', 'rso_member_ticket_no'],
    ],
  },
  {
    title: 'Служебные данные',
    fields: [
      ['ID', 'student_id'],
      ['Создан', 'created_at', formatDateTime],
      ['Обновлен', 'updated_at', formatDateTime],
    ],
  },
];

const bankFields = [
  ['Банк', 'bank_name'],
  ['БИК', 'bik'],
  ['Корреспондентский счет', 'correspondent_account'],
  ['Номер счета', 'account_number'],
  ['Активны', 'is_active', (value) => (value ? 'Да' : 'Нет')],
  ['Созданы', 'created_at', formatDateTime],
];

function formatDate(value) {
  if (!value) {
    return 'Не указано';
  }

  return new Intl.DateTimeFormat('ru-RU').format(new Date(value));
}

function formatDateTime(value) {
  if (!value) {
    return 'Не указано';
  }

  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatValue(value, formatter) {
  if (formatter) {
    return formatter(value);
  }

  return value === null || value === undefined || value === '' ? 'Не указано' : value;
}

function getFullName(student) {
  return [student.last_name, student.first_name, student.middle_name].filter(Boolean).join(' ');
}

function normalizeSearchValue(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('ru-RU');
}

function compareStudentsByFullName(left, right) {
  const fields = ['last_name', 'first_name', 'middle_name'];

  for (const field of fields) {
    const result = String(left[field] || '').localeCompare(String(right[field] || ''), 'ru-RU');
    if (result !== 0) {
      return result;
    }
  }

  return Number(left.student_id) - Number(right.student_id);
}

function DetailList({ fields, source }) {
  return (
    <dl className="participants-page__details-list">
      {fields.map(([label, key, formatter]) => (
        <div className="participants-page__details-row" key={key}>
          <dt>{label}</dt>
          <dd>{formatValue(source[key], formatter)}</dd>
        </div>
      ))}
    </dl>
  );
}

function ParticipantRow({ student, isOpen, onToggle }) {
  const [bankDetails, setBankDetails] = useState([]);
  const [bankStatus, setBankStatus] = useState({ type: 'idle', message: '' });
  const [hasLoadedBankDetails, setHasLoadedBankDetails] = useState(false);

  useEffect(() => {
    if (!isOpen || hasLoadedBankDetails) {
      return;
    }

    let isMounted = true;
    setBankStatus({ type: 'loading', message: 'Загрузка реквизитов...' });

    listBankDetails(student.student_id)
      .then((rows) => {
        if (!isMounted) {
          return;
        }
        setBankDetails(rows);
        setHasLoadedBankDetails(true);
        setBankStatus({ type: 'idle', message: '' });
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }
        setBankStatus({
          type: 'error',
          message: error instanceof Error ? error.message : 'Не удалось загрузить банковские реквизиты.',
        });
      });

    return () => {
      isMounted = false;
    };
  }, [hasLoadedBankDetails, isOpen, student.student_id]);

  return (
    <article className={`participants-page__row ${isOpen ? 'participants-page__row--open' : ''}`}>
      <button
        className="participants-page__summary"
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
      >
        <span className="participants-page__summary-main">
          <span className="participants-page__name">{getFullName(student)}</span>
          <span className="participants-page__birth">Дата рождения: {formatDate(student.birth_date)}</span>
        </span>
        <span className="participants-page__chevron" aria-hidden="true">
          <svg viewBox="0 0 20 20" focusable="false">
            <path d="M6 8L10 12L14 8" />
          </svg>
        </span>
      </button>

      <div className={`participants-page__details-wrapper ${isOpen ? 'participants-page__details-wrapper--open' : ''}`}>
        <div className="participants-page__details">
          <div className="participants-page__details-actions">
            <a className="participants-page__edit-link" href={`#edit/${student.student_id}`}>
              Редактировать запись
            </a>
          </div>

          {studentFieldGroups.map((group) => (
            <section className="participants-page__details-section" key={group.title}>
              <h2>{group.title}</h2>
              <DetailList fields={group.fields} source={student} />
            </section>
          ))}

          <section className="participants-page__details-section participants-page__details-section--wide">
            <h2>Банковские реквизиты</h2>
            {bankStatus.message ? (
              <p className={`participants-page__status participants-page__status--${bankStatus.type}`}>
                {bankStatus.message}
              </p>
            ) : null}
            {!bankStatus.message && bankDetails.length === 0 ? (
              <p className="participants-page__empty-details">Реквизиты не добавлены.</p>
            ) : null}
            {bankDetails.map((details) => (
              <DetailList key={details.bank_details_id} fields={bankFields} source={details} />
            ))}
          </section>
        </div>
      </div>
    </article>
  );
}

export function ParticipantsDatabasePage() {
  const [students, setStudents] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [openStudentId, setOpenStudentId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [status, setStatus] = useState({ type: 'loading', message: 'Загрузка участников...' });

  useEffect(() => {
    let isMounted = true;

    listStudents()
      .then((rows) => {
        if (!isMounted) {
          return;
        }
        setStudents(rows);
        setStatus({ type: 'idle', message: '' });
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }
        setStatus({
          type: 'error',
          message: error instanceof Error ? error.message : 'Не удалось загрузить список участников.',
        });
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const sortedStudents = useMemo(() => {
    return [...students].sort(compareStudentsByFullName);
  }, [students]);

  const visibleStudents = useMemo(() => {
    const normalizedQuery = normalizeSearchValue(searchQuery);

    if (!normalizedQuery) {
      return sortedStudents;
    }

    return sortedStudents.filter((student) => normalizeSearchValue(getFullName(student)).includes(normalizedQuery));
  }, [searchQuery, sortedStudents]);

  const totalPages = Math.max(1, Math.ceil(visibleStudents.length / PAGE_SIZE));

  const paginatedStudents = useMemo(() => {
    const pageStart = (currentPage - 1) * PAGE_SIZE;
    return visibleStudents.slice(pageStart, pageStart + PAGE_SIZE);
  }, [currentPage, visibleStudents]);

  useEffect(() => {
    setCurrentPage(1);
    setOpenStudentId(null);
  }, [searchQuery]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  function goToPage(page) {
    setOpenStudentId(null);
    setCurrentPage(page);
  }

  return (
    <div className="participants-page">
      <div className="participants-page__hero">
        <a className="participants-page__back-link" href="#">
          На главную
        </a>
        <h1 className="participants-page__title">Список участников</h1>
      </div>

      <label className="participants-page__search">
        <span className="participants-page__search-label">Поиск по ФИО</span>
        <input
          className="participants-page__search-input"
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Введите фамилию, имя или отчество"
        />
      </label>

      {status.message ? (
        <p className={`participants-page__status participants-page__status--${status.type}`}>{status.message}</p>
      ) : null}

      {!status.message && sortedStudents.length === 0 ? (
        <p className="participants-page__empty">В базе пока нет участников.</p>
      ) : null}

      {!status.message && sortedStudents.length > 0 && visibleStudents.length === 0 ? (
        <p className="participants-page__empty">По такому ФИО участник не найден.</p>
      ) : null}

      <div className="participants-page__list">
        {paginatedStudents.map((student) => (
          <ParticipantRow
            key={student.student_id}
            student={student}
            isOpen={openStudentId === student.student_id}
            onToggle={() => setOpenStudentId((current) => (current === student.student_id ? null : student.student_id))}
          />
        ))}
      </div>

      {!status.message ? (
        <>
          <p className="participants-page__records-count">
            Найдено записей: {visibleStudents.length} из {sortedStudents.length}. Страница {currentPage} из {totalPages}
          </p>
          {visibleStudents.length > PAGE_SIZE ? (
            <nav className="participants-page__pagination" aria-label="Пагинация списка участников">
              <button
                className="participants-page__page-button"
                type="button"
                onClick={() => goToPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
              >
                Назад
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  className={`participants-page__page-button ${page === currentPage ? 'participants-page__page-button--active' : ''}`}
                  type="button"
                  onClick={() => goToPage(page)}
                >
                  {page}
                </button>
              ))}
              <button
                className="participants-page__page-button"
                type="button"
                onClick={() => goToPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
              >
                Вперёд
              </button>
            </nav>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
