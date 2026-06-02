import { useEffect, useMemo, useState } from 'react';
import { listEvents, listStudents } from '../lib/api.js';
import './HomePage.css';

const primaryActions = [
  { id: 'student-events', label: 'Справка по студенту', href: '#student-events', meta: 'Отчёты' },
  { id: 'documents-spravki', label: 'Документы на трудоустройство', href: '#documents-spravki', meta: 'Документы' },
  { id: 'create-event', label: 'Создать мероприятие', href: '#create-event', meta: 'Мероприятия' },
  { id: 'participants-summary', label: 'Сводная таблица', href: '#participants-summary', meta: 'Отчёты' },
];

const navigationGroups = [
  {
    title: 'Участники',
    links: [
      { label: 'Список участников', href: '#database' },
      { label: 'Добавить участника', href: '#create' },
      { label: 'Импорт из файла', href: '#import' },
    ],
  },
  {
    title: 'Мероприятия',
    links: [
      { label: 'Список мероприятий', href: '#events-list' },
      { label: 'Создать мероприятие', href: '#create-event' },
      { label: 'Статистика по мероприятию', href: '#event-statistics' },
    ],
  },
  {
    title: 'Отчёты и документы',
    links: [
      { label: 'Участие студента', href: '#student-events' },
      { label: 'Сводная таблица', href: '#participants-summary' },
      { label: 'Трудоустройство', href: '#documents-spravki' },
    ],
  },
];

function formatDate(value) {
  if (!value) return '—';
  return new Date(`${String(value).slice(0, 10)}T12:00:00`).toLocaleDateString('ru-RU');
}

function sortEventsByDate(events) {
  return [...events].sort((left, right) => {
    const leftDate = String(left.start_date || '');
    const rightDate = String(right.start_date || '');
    return leftDate.localeCompare(rightDate) || String(left.event_name || '').localeCompare(String(right.event_name || ''), 'ru');
  });
}

export function HomePage() {
  const [students, setStudents] = useState([]);
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    Promise.all([
      listStudents({ limit: 200, isActive: true }),
      listEvents({ limit: 200 }),
    ])
      .then(([studentRows, eventRows]) => {
        if (!isMounted) return;
        setStudents(studentRows || []);
        setEvents(eventRows || []);
      })
      .catch(() => {
        if (!isMounted) return;
        setStudents([]);
        setEvents([]);
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const visibleEvents = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const sorted = sortEventsByDate(events);
    const upcoming = sorted.filter((event) => String(event.start_date || '') >= today);
    return (upcoming.length > 0 ? upcoming : sorted).slice(0, 4);
  }, [events]);

  return (
    <div className="home-page">
      <section className="home-page__hero">
        <div className="home-page__hero-main">
          <p className="home-page__eyebrow">Рабочая панель</p>
          <h1 className="home-page__title">Учёт занятости студентов СОПКи</h1>
        </div>

        <div className="home-page__stats" aria-label="Сводка">
          <div className="home-page__stat">
            <span className="home-page__stat-value">{isLoading ? '—' : students.length}</span>
            <span className="home-page__stat-label">участников</span>
          </div>
          <div className="home-page__stat">
            <span className="home-page__stat-value">{isLoading ? '—' : events.length}</span>
            <span className="home-page__stat-label">мероприятий</span>
          </div>
          <div className="home-page__stat">
            <span className="home-page__stat-value">{isLoading ? '—' : visibleEvents.length}</span>
            <span className="home-page__stat-label">в работе</span>
          </div>
        </div>
      </section>

      <section className="home-page__primary-grid" aria-label="Основные действия">
        {primaryActions.map((action) => (
          <a key={action.id} className="home-page__primary-card" href={action.href}>
            <span className="home-page__primary-meta">{action.meta}</span>
            <span className="home-page__primary-label">{action.label}</span>
          </a>
        ))}
      </section>

      <div className="home-page__layout">
        <section className="home-page__section">
          <h2 className="home-page__section-title">Разделы</h2>
          <div className="home-page__nav-grid">
            {navigationGroups.map((group) => (
              <div key={group.title} className="home-page__nav-card">
                <h3>{group.title}</h3>
                <ul>
                  {group.links.map((link) => (
                    <li key={link.href}>
                      <a href={link.href}>{link.label}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <aside className="home-page__section home-page__events">
          <div className="home-page__events-head">
            <h2 className="home-page__section-title">Мероприятия</h2>
            <a href="#events-list">Все</a>
          </div>
          <div className="home-page__events-list">
            {visibleEvents.length === 0 ? (
              <p className="home-page__empty">Мероприятия не найдены.</p>
            ) : (
              visibleEvents.map((event) => (
                <a key={event.event_id} className="home-page__event-row" href={`#event-details?id=${event.event_id}`}>
                  <span className="home-page__event-name">{event.event_name}</span>
                  <span className="home-page__event-meta">
                    {formatDate(event.start_date)} · {event.event_type_name || event.event_level || 'Без типа'}
                  </span>
                </a>
              ))
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
