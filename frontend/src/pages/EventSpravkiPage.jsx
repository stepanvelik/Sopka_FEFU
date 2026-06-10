import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '../components/ui/PageHeader.jsx';
import {
  downloadEventSpravkiArchive,
  listEventParticipants,
  listEvents,
  listStudents,
} from '../lib/api.js';
import { formatPhone, getStudentFullName, roleOptions } from '../lib/participantUtils.js';
import './EventSpravkiPage.css';

function getInitialEventId() {
  const raw = (window.location.hash || '').replace(/^#/, '');
  const query = raw.includes('?') ? raw.slice(raw.indexOf('?') + 1) : '';
  return new URLSearchParams(query).get('event_id') || '';
}

function formatDate(value) {
  if (!value) return '-';
  return new Date(`${String(value).slice(0, 10)}T12:00:00`).toLocaleDateString('ru-RU');
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

function participantMatchesDates(participant, dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return true;
  const slots = participant.time_slots || [];
  if (slots.length === 0) return true;

  return slots.some((slot) => {
    const date = String(slot.participation_date || '').slice(0, 10);
    if (!date) return false;
    if (dateFrom && date < dateFrom) return false;
    if (dateTo && date > dateTo) return false;
    return true;
  });
}

export function EventSpravkiPage() {
  const [events, setEvents] = useState([]);
  const [students, setStudents] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [eventId, setEventId] = useState(getInitialEventId);
  const [roleName, setRoleName] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedOnly, setSelectedOnly] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [status, setStatus] = useState({ type: 'loading', message: 'Загрузка данных...' });
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    let isMounted = true;

    Promise.all([
      listEvents({ limit: 200 }),
      listStudents({ limit: 200, isActive: true }),
    ])
      .then(([eventRows, studentRows]) => {
        if (!isMounted) return;
        const sorted = [...(eventRows || [])].sort((left, right) => {
          const leftDate = String(left.start_date || '');
          const rightDate = String(right.start_date || '');
          return leftDate.localeCompare(rightDate)
            || String(left.event_name || '').localeCompare(String(right.event_name || ''), 'ru');
        });
        setEvents(sorted);
        setStudents(studentRows || []);
        setStatus({ type: 'idle', message: '' });
      })
      .catch((error) => {
        if (!isMounted) return;
        setStatus({
          type: 'error',
          message: error instanceof Error ? error.message : 'Не удалось загрузить данные.',
        });
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!eventId) {
      setParticipants([]);
      setSelectedIds([]);
      return;
    }

    let isMounted = true;
    setStatus({ type: 'loading', message: 'Загрузка участников мероприятия...' });

    listEventParticipants(eventId)
      .then((rows) => {
        if (!isMounted) return;
        setParticipants(rows || []);
        setSelectedIds([]);
        setStatus({ type: 'idle', message: '' });
      })
      .catch((error) => {
        if (!isMounted) return;
        setParticipants([]);
        setSelectedIds([]);
        setStatus({
          type: 'error',
          message: error instanceof Error ? error.message : 'Не удалось загрузить участников мероприятия.',
        });
      });

    return () => {
      isMounted = false;
    };
  }, [eventId]);

  const studentsById = useMemo(() => {
    return students.reduce((acc, student) => {
      acc[student.student_id] = student;
      return acc;
    }, {});
  }, [students]);

  const selectedEvent = events.find((event) => String(event.event_id) === String(eventId));

  const filteredParticipants = useMemo(() => {
    return participants.filter((participant) => {
      const roleMatches = !roleName || participant.role_name === roleName;
      const dateMatches = participantMatchesDates(participant, dateFrom, dateTo);
      return roleMatches && dateMatches;
    });
  }, [participants, roleName, dateFrom, dateTo]);

  const visibleSelectedIds = filteredParticipants
    .map((participant) => participant.student_id)
    .filter((studentId) => selectedIds.includes(studentId));

  const allVisibleSelected = filteredParticipants.length > 0
    && visibleSelectedIds.length === filteredParticipants.length;

  function toggleParticipant(studentId) {
    setSelectedIds((current) => (
      current.includes(studentId)
        ? current.filter((item) => item !== studentId)
        : [...current, studentId]
    ));
  }

  function toggleAllVisible() {
    if (allVisibleSelected) {
      const visible = new Set(filteredParticipants.map((participant) => participant.student_id));
      setSelectedIds((current) => current.filter((studentId) => !visible.has(studentId)));
      return;
    }

    setSelectedIds((current) => {
      const next = new Set(current);
      filteredParticipants.forEach((participant) => next.add(participant.student_id));
      return [...next];
    });
  }

  async function handleDownloadArchive() {
    if (!eventId) {
      setStatus({ type: 'error', message: 'Выберите мероприятие.' });
      return;
    }
    if (selectedOnly && visibleSelectedIds.length === 0) {
      setStatus({ type: 'error', message: 'Выберите участников для архива или отключите фильтр выбранных.' });
      return;
    }

    setIsDownloading(true);
    setStatus({ type: 'loading', message: 'Формирование архива справок...' });

    try {
      const { blob, filename } = await downloadEventSpravkiArchive({
        eventId,
        roleName,
        dateFrom,
        dateTo,
        studentIds: selectedOnly ? visibleSelectedIds : [],
      });
      triggerDownload(blob, filename);
      setStatus({ type: 'idle', message: 'Архив сформирован и загружен.' });
    } catch (error) {
      setStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Не удалось сформировать архив справок.',
      });
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <div className="event-spravki-page">
      <PageHeader title="Справки по мероприятию" />

      <section className="event-spravki-page__panel">
        <div className="event-spravki-page__controls">
          <label className="event-spravki-page__field event-spravki-page__field--event">
            <span>Мероприятие</span>
            <select value={eventId} onChange={(event) => setEventId(event.target.value)}>
              <option value="">Выберите мероприятие</option>
              {events.map((event) => (
                <option key={event.event_id} value={String(event.event_id)}>
                  {event.event_name} ({formatDate(event.start_date)})
                </option>
              ))}
            </select>
          </label>

          <label className="event-spravki-page__field">
            <span>Роль</span>
            <select value={roleName} onChange={(event) => setRoleName(event.target.value)}>
              <option value="">Все роли</option>
              {roleOptions.map((role) => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          </label>

          <label className="event-spravki-page__field">
            <span>С даты участия</span>
            <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
          </label>

          <label className="event-spravki-page__field">
            <span>По дату участия</span>
            <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
          </label>
        </div>

        {selectedEvent ? (
          <div className="event-spravki-page__event-summary">
            <span>{selectedEvent.event_level || 'Уровень не указан'}</span>
            <span>{selectedEvent.event_type_name || 'Тип не указан'}</span>
            <span>{formatDate(selectedEvent.start_date)}{selectedEvent.end_date ? ` - ${formatDate(selectedEvent.end_date)}` : ''}</span>
          </div>
        ) : null}

        <div className="event-spravki-page__actions">
          <label className="event-spravki-page__checkbox">
            <input
              type="checkbox"
              checked={selectedOnly}
              onChange={(event) => setSelectedOnly(event.target.checked)}
            />
            <span>Только выбранные участники</span>
          </label>
          <button
            type="button"
            className="event-spravki-page__download"
            disabled={!eventId || isDownloading}
            onClick={handleDownloadArchive}
          >
            {isDownloading ? 'Формирование...' : 'Сформировать архив справок'}
          </button>
        </div>

        {status.message ? (
          <p className={`event-spravki-page__status event-spravki-page__status--${status.type}`}>
            {status.message}
          </p>
        ) : null}
      </section>

      <section className="event-spravki-page__table-frame">
        <table className="event-spravki-page__table">
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleAllVisible}
                  disabled={filteredParticipants.length === 0}
                  aria-label="Выбрать всех видимых участников"
                />
              </th>
              <th>ФИО</th>
              <th>Телефон</th>
              <th>Роль</th>
              <th>Слотов участия</th>
            </tr>
          </thead>
          <tbody>
            {!eventId ? (
              <tr>
                <td colSpan="5" className="event-spravki-page__empty">Выберите мероприятие.</td>
              </tr>
            ) : filteredParticipants.length === 0 ? (
              <tr>
                <td colSpan="5" className="event-spravki-page__empty">Участники по выбранным условиям не найдены.</td>
              </tr>
            ) : (
              filteredParticipants.map((participant) => {
                const student = studentsById[participant.student_id];
                const fullName = getStudentFullName(student) || `ID ${participant.student_id}`;
                const isSelected = selectedIds.includes(participant.student_id);

                return (
                  <tr key={participant.participation_id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleParticipant(participant.student_id)}
                        aria-label={`Выбрать ${fullName}`}
                      />
                    </td>
                    <td>
                      <a href={`#edit-participant?id=${participant.student_id}`}>{fullName}</a>
                    </td>
                    <td>{formatPhone(student?.phone) || '-'}</td>
                    <td>{participant.role_name || '-'}</td>
                    <td>{participant.time_slots?.length || 0}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
