import { useState, useEffect } from 'react';
import {
  listEvents,
  deleteEvent as deleteEventApi,
  listEventParticipants,
  listEventTypes,
} from '../lib/api.js';

import './EventsListPage.css';
import { FilterBar } from '../components/ui/FilterBar.jsx';
import { PageHeader } from '../components/ui/PageHeader.jsx';
import { formatEventScheduleSummary } from '../lib/eventScheduleUtils.js';
import { EventViewModal } from './EventViewModal';

function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('ru-RU');
}

function formatTime(timeString) {
  if (!timeString) return '';
  return timeString.slice(0, 5);
}

/** YYYY-MM-DD для сравнения периодов */
function toIsoDate(value) {
  if (!value) return '';
  if (typeof value === 'string') return value.slice(0, 10);
  try {
    return new Date(value).toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

/** Пересечение интервала мероприятия [start..end] с фильтром [from..to] */
function eventInDateRange(event, dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return true;
  const from = dateFrom || dateTo;
  const to = dateTo || dateFrom;
  const es = toIsoDate(event.start_date);
  const ee = toIsoDate(event.end_date || event.start_date);
  if (!es) return false;
  return es <= to && ee >= from;
}

export function EventsListPage() {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [eventTypeCatalog, setEventTypeCatalog] = useState([]);

  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    let mounted = true;
    listEventTypes({ limit: 200, isActive: true })
      .then((data) => {
        if (mounted) setEventTypeCatalog(data || []);
      })
      .catch(() => {
        if (mounted) setEventTypeCatalog([]);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    async function loadEventsWithParticipants() {
      try {
        setLoading(true);
        const eventsData = await listEvents({ limit: 200 });

        const eventsWithCounts = await Promise.all(
          eventsData.map(async (event) => {
            try {
              const participants = await listEventParticipants(event.event_id);
              return { ...event, participants_count: participants.length };
            } catch (err) {
              console.error(`Не удалось загрузить участников для мероприятия ${event.event_id}:`, err);
              return { ...event, participants_count: 0 };
            }
          }),
        );

        setEvents(eventsWithCounts);
      } catch (err) {
        console.error('Не удалось загрузить мероприятия:', err);
      } finally {
        setLoading(false);
      }
    }

    loadEventsWithParticipants();
  }, []);

  const filteredEvents = events
    .filter((event) => {
      const matchesSearch = event.event_name?.toLowerCase().includes(search.toLowerCase());
      const matchesLevel = !levelFilter || event.event_level === levelFilter;
      const matchesType = !typeFilter || event.event_type_name === typeFilter;
      const matchesPeriod = eventInDateRange(event, dateFrom, dateTo);
      return matchesSearch && matchesLevel && matchesType && matchesPeriod;
    })
    .sort((left, right) => {
      const leftDate = toIsoDate(left.start_date) || '9999-12-31';
      const rightDate = toIsoDate(right.start_date) || '9999-12-31';
      return leftDate.localeCompare(rightDate)
        || String(left.event_name || '').localeCompare(String(right.event_name || ''), 'ru');
    });

  const uniqueLevels = [...new Set(events.map((e) => e.event_level).filter(Boolean))];

  const typeOptions = [
    ...new Set(
      [
        ...eventTypeCatalog.map((t) => t.event_type_name).filter(Boolean),
        ...events.map((e) => e.event_type_name).filter(Boolean),
      ],
    ),
  ].sort((a, b) => a.localeCompare(b, 'ru'));

  const deleteEvent = async (id, e) => {
    e.stopPropagation();
    if (window.confirm('Вы уверены, что хотите удалить это мероприятие?')) {
      try {
        await deleteEventApi(id);
        setEvents(events.filter((event) => event.event_id !== id));
      } catch (err) {
        alert(`Не удалось удалить: ${err.message || 'Ошибка'}`);
      }
    }
  };

  const goToEdit = (id, e) => {
    e.stopPropagation();
    window.location.hash = `edit-event?id=${id}`;
  };
 //  переход на страницу деталей мероприятия
  const goToDetails = (id, e) => {
    e.stopPropagation();
    window.location.hash = `event-details?id=${id}`;
  };
  if (loading) {
    return (
      <div className="events-list-page">
        <div className="loading-state">Загрузка мероприятий...</div>
      </div>
    );
  }

  return (
    <div className="events-list-page">
      <div className="events-list-header">
        <PageHeader
          title="Мероприятия"
          backLabel="← На главную"
          onBack={() => { window.location.hash = ''; }}
          variant="events"
          actions={(
            <>
              <button type="button" className="add-event-button" onClick={() => { window.location.hash = 'create-event'; }}>
                Добавить мероприятие
              </button>
              <div className="events-total-count">Найдено: {filteredEvents.length}</div>
            </>
          )}
        />

        <FilterBar
          searchValue={search}
          searchPlaceholder="Поиск по названию..."
          onSearchChange={setSearch}
          levelValue={levelFilter}
          levelOptions={uniqueLevels}
          onLevelChange={setLevelFilter}
          typeValue={typeFilter}
          typeOptions={typeOptions}
          onTypeChange={setTypeFilter}
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
          onReset={() => {
              setSearch('');
              setLevelFilter('');
              setTypeFilter('');
              setDateFrom('');
              setDateTo('');
            }}
        />
      </div>

      <div className="events-grid">
        {filteredEvents.length > 0 ? (
          filteredEvents.map((event) => (
            <div
              key={event.event_id}
              className="event-card app-card"
              onClick={() => setSelectedEvent(event)}
              style={{ cursor: 'pointer' }}
            >
              <div className="event-actions">
                 <button
                  type="button"
                  className="action-btn app-icon-button details-btn"
                  title="Статистика"
                  onClick={(e) => goToDetails(event.event_id, e)}
                >
                  📶
                   </button>
          <button type="button" className="action-btn app-icon-button edit-btn" title="Отредактировать" onClick={(e) => goToEdit(event.event_id, e)}>
                  ✎
                </button>
                <button type="button" className="action-btn app-icon-button delete-btn" title="Удалить мероприятие" onClick={(e) => deleteEvent(event.event_id, e)}>
                  ×
                </button>
              </div>

              <div className="event-card-header">
                <span className="event-card-name">{event.event_name}</span>
              </div>

              <div className="event-card-body">
                <div className="event-card-meta">
                  <span className="event-card-level" title="Уровень">{event.event_level}</span>
                  {event.event_type_name ? (
                    <span className="event-card-type" title="Тип мероприятия">{event.event_type_name}</span>
                  ) : (
                    <span className="event-card-type event-card-type--muted">Тип не указан</span>
                  )}
                </div>
                <div className="event-card-info">
                  <span className="event-card-datetime">
                    {formatDate(event.start_date)}
                    {event.end_date && (
                      <>
                        {' — '}
                        {formatDate(event.end_date)}
                      </>
                    )}
                    <br />
                    {formatEventScheduleSummary(event) || (
                      <>
                        {formatTime(event.start_time)}
                        {event.end_time && (
                          <>
                            {' - '}
                            {formatTime(event.end_time)}
                          </>
                        )}
                      </>
                    )}
                  </span>
                  <div className="event-card-participants">
                    <span className="participants-label">Кол. участников</span>
                    <div className="participants-badge">{event.participants_count || 0}</div>
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="empty-state">Ничего не найдено</div>
        )}
      </div>

      {selectedEvent && (
        <EventViewModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      )}
    </div>
  );
}
