import { useEffect, useState } from 'react';
import { FilterBar } from '../components/ui/FilterBar.jsx';
import { PageHeader } from '../components/ui/PageHeader.jsx';
import { downloadStudentSpravka, getEvent, getStudentEventsReport, listEventTypes } from '../lib/api.js';
import { formatHoursMinutes } from '../lib/eventScheduleUtils.js';
import { EventViewModal } from './EventViewModal';
import './StudentEventsPage.css';

const eventLevelOptions = [
  'Всероссийский',
  'Региональный',
  'Городской',
  'Университетский',
  'Институтский',
];

const emptyReport = {
  full_name: '',
  phone: null,
  total_hours: 0,
  total_events: 0,
  events: [],
  matches: [],
};

function formatPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) {
    return 'Не указан';
  }
  if (digits.length === 11 && digits.startsWith('7')) {
    return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9, 11)}`;
  }
  return digits;
}

function formatHours(value) {
  return formatHoursMinutes(value, '\u2014');
}

function formatDate(value) {
  if (!value) {
    return '—';
  }
  return new Date(`${String(value).slice(0, 10)}T12:00:00`).toLocaleDateString('ru-RU');
}

export function StudentEventsPage() {
  const [filters, setFilters] = useState({
    search: '',
    dateFrom: '',
    dateTo: '',
    eventLevel: '',
    eventTypeId: '',
  });
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [appliedFilters, setAppliedFilters] = useState(filters);
  const [appliedStudentId, setAppliedStudentId] = useState('');
  const [eventTypes, setEventTypes] = useState([]);
  const [report, setReport] = useState(emptyReport);
  const [status, setStatus] = useState({ type: 'idle', message: '' });
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [loadingEventId, setLoadingEventId] = useState(null);
  const [spravkaEventId, setSpravkaEventId] = useState('');
  const [spravkaLoading, setSpravkaLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;

    listEventTypes({ limit: 200, isActive: true })
      .then((rows) => {
        if (isMounted) {
          setEventTypes(rows || []);
        }
      })
      .catch(() => {
        if (isMounted) {
          setEventTypes([]);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!appliedFilters.search.trim() && !appliedStudentId) {
      setReport(emptyReport);
      setStatus({ type: 'idle', message: '' });
      return;
    }

    let isMounted = true;
    setStatus({ type: 'loading', message: 'Поиск участника...' });

    getStudentEventsReport({
      ...appliedFilters,
      studentId: appliedStudentId,
    })
      .then((data) => {
        if (!isMounted) {
          return;
        }

        const matches = data?.matches || [];
        if (matches.length > 0) {
          setReport({ ...emptyReport, matches });
          setStatus({
            type: 'idle',
            message: `Найдено участников: ${matches.length}. Выберите нужного из списка.`,
          });
          return;
        }

        if (!data || !data.full_name) {
          setReport(emptyReport);
          setStatus({
            type: 'error',
            message: 'Участник не найден. Проверьте ФИО или номер телефона.',
          });
        } else {
          setReport(data);
          setStatus({ type: 'idle', message: '' });
        }
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }
        setReport(emptyReport);
        setStatus({
          type: 'error',
          message: error instanceof Error ? error.message : 'Не удалось загрузить данные участника.',
        });
      });

    return () => {
      isMounted = false;
    };
  }, [appliedFilters, appliedStudentId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setAppliedFilters(filters);
      setAppliedStudentId(selectedStudentId);
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [filters, selectedStudentId]);

  useEffect(() => {
    if (report.events?.length === 1) {
      setSpravkaEventId(String(report.events[0].event_id));
      return;
    }
    setSpravkaEventId('');
  }, [report.student_id, report.events]);

  function updateFilter(name, value) {
    setFilters((current) => ({ ...current, [name]: value }));
    if (name === 'search') {
      setSelectedStudentId('');
    }
  }

  function resetFilters() {
    const nextFilters = {
      search: '',
      dateFrom: '',
      dateTo: '',
      eventLevel: '',
      eventTypeId: '',
    };
    setFilters(nextFilters);
    setAppliedFilters(nextFilters);
    setSelectedStudentId('');
    setAppliedStudentId('');
    setReport(emptyReport);
    setStatus({ type: 'idle', message: '' });
  }

  function selectStudent(studentId) {
    setSelectedStudentId(String(studentId));
    setAppliedStudentId(String(studentId));
  }

  function triggerSpravkaDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function createSpravka(eventId) {
    if (!report.student_id || !eventId) {
      return;
    }

    setSpravkaLoading(true);
    setStatus({ type: 'loading', message: 'Формирование справки...' });
    try {
      const { blob, filename } = await downloadStudentSpravka({
        studentId: report.student_id,
        eventId,
        dateFrom: appliedFilters.dateFrom,
        dateTo: appliedFilters.dateTo,
      });
      triggerSpravkaDownload(blob, filename);
      setStatus({ type: 'idle', message: 'Справка сформирована и загружена.' });
    } catch (error) {
      setStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Не удалось сформировать справку.',
      });
    } finally {
      setSpravkaLoading(false);
    }
  }

  async function handleCreateSpravka() {
    if (!hasEvents) {
      setStatus({
        type: 'error',
        message: 'Нет мероприятий для формирования справки.',
      });
      return;
    }

    if (report.events.length === 1) {
      await createSpravka(report.events[0].event_id);
      return;
    }

    if (!spravkaEventId) {
      setStatus({
        type: 'error',
        message: 'Выберите мероприятие для справки.',
      });
      return;
    }

    await createSpravka(Number(spravkaEventId));
  }

  async function openEventView(eventRow) {
    if (!eventRow?.event_id) {
      return;
    }

    setLoadingEventId(eventRow.event_id);
    try {
      const event = await getEvent(eventRow.event_id);
      setSelectedEvent({
        ...event,
        event_type_name: eventRow.event_type || event.event_type_name,
      });
    } catch (error) {
      setStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Не удалось загрузить данные мероприятия.',
      });
    } finally {
      setLoadingEventId(null);
    }
  }

  const hasMatches = report.matches && report.matches.length > 0;
  const hasEvents = report.events && report.events.length > 0;
  const hasData = report.full_name && report.full_name.trim() !== '';

  return (
    <div className="student-events-page">
      <PageHeader title="Участие студента в мероприятиях" />

      <FilterBar
        searchValue={filters.search}
        searchPlaceholder="Поиск по ФИО или номеру телефона"
        onSearchChange={(value) => updateFilter('search', value)}
        levelValue={filters.eventLevel}
        levelOptions={eventLevelOptions}
        onLevelChange={(value) => updateFilter('eventLevel', value)}
        typeValue={filters.eventTypeId}
        typeOptions={eventTypes.map((eventType) => ({
          value: String(eventType.event_type_id),
          label: eventType.event_type_name,
        }))}
        onTypeChange={(value) => updateFilter('eventTypeId', value)}
        dateFrom={filters.dateFrom}
        dateTo={filters.dateTo}
        onDateFromChange={(value) => updateFilter('dateFrom', value)}
        onDateToChange={(value) => updateFilter('dateTo', value)}
        onReset={resetFilters}
      />

      {status.message ? (
        <p className={`student-events-page__status student-events-page__status--${status.type}`}>
          {status.message}
        </p>
      ) : null}

      {hasMatches ? (
        <div className="student-events-page__matches">
          <h2 className="student-events-page__matches-title">Похожие участники</h2>
          <ul className="student-events-page__matches-list">
            {report.matches.map((match) => {
              const isSelected = String(match.student_id) === String(selectedStudentId);
              return (
                <li key={match.student_id}>
                  <button
                    type="button"
                    className={`student-events-page__match-btn${isSelected ? ' student-events-page__match-btn--selected' : ''}`}
                    onClick={() => selectStudent(match.student_id)}
                  >
                    <span className="student-events-page__match-name">{match.full_name}</span>
                    <span className="student-events-page__match-phone">{formatPhone(match.phone)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {hasData && (
        <>
          <div className="student-events-page__spravka-bar">
            {report.events.length > 1 ? (
              <label className="student-events-page__spravka-select-wrap">
                <span className="student-events-page__spravka-select-label">Мероприятие для справки</span>
                <select
                  className="student-events-page__spravka-select"
                  value={spravkaEventId}
                  onChange={(event) => setSpravkaEventId(event.target.value)}
                  disabled={spravkaLoading}
                >
                  <option value="">Выберите мероприятие</option>
                  {report.events.map((event) => (
                    <option key={event.event_id} value={String(event.event_id)}>
                      {event.event_name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <button
              type="button"
              className="student-events-page__spravka-btn"
              onClick={handleCreateSpravka}
              disabled={spravkaLoading || !hasEvents}
            >
              {spravkaLoading ? 'Формирование...' : 'Создать справку'}
            </button>
          </div>

          <div className="student-events-page__info-cards">
            <div className="student-events-page__info-card student-events-page__info-card--student">
              <div className="student-events-page__info-label">{report.full_name}</div>
              <div className="student-events-page__info-phone">{formatPhone(report.phone)}</div>
              <a className="student-events-page__student-card-link" href={`#edit-participant?id=${report.student_id}`}>
                Открыть карточку студента
              </a>
            </div>
            <div className="student-events-page__info-card">
              <div className="student-events-page__info-label">{formatHours(report.total_hours)}</div>
              <div className="student-events-page__info-title">Общее число рабочих часов</div>
            </div>
            <div className="student-events-page__info-card">
              <div className="student-events-page__info-label">{report.total_events || 0}</div>
              <div className="student-events-page__info-title">Общее число посещенных мероприятий</div>
            </div>
          </div>

          {!hasEvents ? (
            <p className="student-events-page__empty">
              По выбранным условиям мероприятия не найдены.
            </p>
          ) : (
            <div className="student-events-page__table-frame">
              <table className="student-events-page__table">
                <thead>
                  <tr>
                    <th>Наименование мероприятия</th>
                    <th>Дата мероприятия</th>
                    <th>Роль на мероприятии</th>
                    <th>Количество часов</th>
                    <th>Уровень мероприятия</th>
                    <th>Тип мероприятия</th>
                  </tr>
                </thead>
                <tbody>
                  {report.events.map((event, index) => (
                    <tr key={`${event.event_id}-${event.role}-${index}`}>
                      <td className="student-events-page__event-name-cell">
                        <button
                          type="button"
                          className="student-events-page__event-link"
                          onClick={() => openEventView(event)}
                          disabled={loadingEventId === event.event_id}
                        >
                          {loadingEventId === event.event_id ? 'Загрузка...' : (event.event_name || '—')}
                        </button>
                      </td>
                      <td>{formatDate(event.event_date)}</td>
                      <td>{event.role || '—'}</td>
                      <td className="student-events-page__hours-cell">{formatHours(event.hours)}</td>
                      <td>{event.event_level || '—'}</td>
                      <td>{event.event_type || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {selectedEvent ? (
        <EventViewModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      ) : null}

      <div className="student-events-page__back-link">
        <a href="#home" className="student-events-page__back-link-btn">
          ← Вернуться к списку отчётов
        </a>
      </div>
    </div>
  );
}
