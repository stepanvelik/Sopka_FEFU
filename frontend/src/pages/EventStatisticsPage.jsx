import { useEffect, useState } from 'react';
import { PageHeader } from '../components/ui/PageHeader.jsx';
import { listEvents } from '../lib/api.js';
import { formatEventScheduleSummary } from '../lib/eventScheduleUtils.js';
import EventDetailsPage from './EventDetailsPage.jsx';
import './EventStatisticsPage.css';

function formatDate(value) {
  if (!value) {
    return '';
  }
  return new Date(`${String(value).slice(0, 10)}T12:00:00`).toLocaleDateString('ru-RU');
}

function getEventDateLabel(event) {
  const start = formatDate(event.start_date);
  const end = formatDate(event.end_date);
  return end && end !== start ? `${start} — ${end}` : start;
}

function getInitialEventId() {
  const raw = (window.location.hash || '').replace(/^#/, '');
  const query = raw.includes('?') ? raw.slice(raw.indexOf('?') + 1) : '';
  return new URLSearchParams(query).get('event_id') || '';
}

export function EventStatisticsPage() {
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(getInitialEventId);
  const [status, setStatus] = useState({ type: 'loading', message: 'Загрузка списка мероприятий...' });

  useEffect(() => {
    let isMounted = true;

    listEvents({ limit: 200 })
      .then((rows) => {
        if (!isMounted) {
          return;
        }
        const sorted = [...(rows || [])].sort((left, right) => {
          const leftDate = String(left.start_date || '');
          const rightDate = String(right.start_date || '');
          return leftDate.localeCompare(rightDate) || String(left.event_name || '').localeCompare(String(right.event_name || ''), 'ru');
        });
        setEvents(sorted);
        setSelectedEventId((current) => current || (sorted[0] ? String(sorted[0].event_id) : ''));
        setStatus({ type: 'idle', message: '' });
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }
        setEvents([]);
        setStatus({
          type: 'error',
          message: error instanceof Error ? error.message : 'Не удалось загрузить мероприятия.',
        });
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const selectedEvent = events.find((event) => String(event.event_id) === String(selectedEventId));

  return (
    <div className="event-statistics-page">
      <PageHeader title="Статистика по мероприятию" />

      <p className="event-statistics-page__hint">
        Выберите мероприятие, чтобы открыть информацию об участниках, ролях и часах участия.
      </p>

      {status.message ? (
        <p className={`event-statistics-page__status event-statistics-page__status--${status.type}`}>
          {status.message}
        </p>
      ) : null}

      {!status.message && events.length === 0 ? (
        <p className="event-statistics-page__empty">Мероприятия не найдены. Сначала создайте мероприятие.</p>
      ) : null}

      {events.length > 0 ? (
        <div className="event-statistics-page__panel">
          <label className="event-statistics-page__label" htmlFor="event-statistics-select">
            <span>Мероприятие</span>
            <select
              id="event-statistics-select"
              className="event-statistics-page__select"
              value={selectedEventId}
              onChange={(event) => setSelectedEventId(event.target.value)}
            >
              <option value="">Выберите мероприятие</option>
              {events.map((event) => (
                <option key={event.event_id} value={String(event.event_id)}>
                  {event.event_name} ({getEventDateLabel(event)})
                </option>
              ))}
            </select>
          </label>

          {selectedEvent ? (
            <div className="event-statistics-page__preview">
              <div><strong>Уровень:</strong> {selectedEvent.event_level || '—'}</div>
              <div><strong>Тип:</strong> {selectedEvent.event_type_name || '—'}</div>
              <div>
                <strong>Расписание:</strong>{' '}
                {formatEventScheduleSummary(selectedEvent) || getEventDateLabel(selectedEvent) || '—'}
              </div>
            </div>
          ) : null}

          <a
            className={`event-statistics-page__docs-link${selectedEventId ? '' : ' event-statistics-page__docs-link--disabled'}`}
            href={selectedEventId ? `#event-spravki?event_id=${selectedEventId}` : '#event-statistics'}
            aria-disabled={!selectedEventId}
          >
            Перейти к документам мероприятия
          </a>
        </div>
      ) : null}

      {selectedEventId ? (
        <EventDetailsPage eventId={selectedEventId} embedded />
      ) : null}

      <div className="event-statistics-page__back-link">
        <a href="#home" className="event-statistics-page__back-link-btn">
          ← Вернуться к списку отчётов
        </a>
      </div>
    </div>
  );
}
