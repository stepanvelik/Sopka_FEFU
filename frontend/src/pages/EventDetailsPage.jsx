import { useEffect, useState } from 'react';
import { getEvent, getStudent, listEventParticipants } from '../lib/api';
import { enumerateEventDates, formatHoursMinutes, formatRuDateShort } from '../lib/eventScheduleUtils.js';
import { formatPhone, getStudentFullName } from '../lib/participantUtils.js';
import '../components/EventParticipantFields.css';
import './EventDetailsPage.css';

function sumParticipationHours(participant, selectedDates, hasDateFilter) {
  const slots = participant.time_slots || [];
  if (slots.length > 0) {
    const selected = new Set(selectedDates);
    return slots
      .filter((slot) => !hasDateFilter || selected.has(String(slot.participation_date || '').slice(0, 10)))
      .reduce((sum, slot) => sum + Number(slot.participation_hours || 0), 0);
  }

  return Number(participant.hours || participant.duration_hours || 0);
}

function normalizeRoleName(roleName) {
  return String(roleName || '').trim().toLowerCase();
}

function isRole(participant, names) {
  const role = normalizeRoleName(participant.role_name);
  return names.some((name) => role === name || role.includes(name));
}

function getEventDateRange(event) {
  return enumerateEventDates(
    String(event?.start_date || '').slice(0, 10),
    String(event?.end_date || event?.start_date || '').slice(0, 10),
  );
}

function participantMatchesDates(participant, selectedDates, hasDateFilter) {
  const slots = participant.time_slots || [];
  if (!hasDateFilter) return true;
  if (selectedDates.length === 0) return false;
  if (slots.length === 0) return true;

  const selected = new Set(selectedDates);
  return slots.some((slot) => selected.has(String(slot.participation_date || '').slice(0, 10)));
}

const EventDetailsPage = ({ eventId, embedded = false }) => {
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [participations, setParticipations] = useState([]);
  const [studentsCache, setStudentsCache] = useState([]);
  const [selectedDates, setSelectedDates] = useState([]);
  const [expandedSections, setExpandedSections] = useState({
    leaders: true,
    organizers: true,
    executors: true,
    volunteers: false,
    participants: false,
    other: false,
  });

  useEffect(() => {
    if (eventId) {
      loadData();
    }
  }, [eventId]);

  const loadParticipantStudents = async (participantsData) => {
    const studentIds = [
      ...new Set(participantsData.map((participant) => participant.student_id).filter(Boolean)),
    ];

    const results = await Promise.allSettled(studentIds.map((studentId) => getStudent(studentId)));

    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`Не удалось загрузить студента ${studentIds[index]}:`, result.reason);
      }
    });

    return results
      .filter((result) => result.status === 'fulfilled')
      .map((result) => result.value);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [eventData, participantsData] = await Promise.all([
        getEvent(eventId),
        listEventParticipants(eventId),
      ]);
      const studentsData = await loadParticipantStudents(participantsData);

      setEvent(eventData);
      setParticipations(participantsData);
      setStudentsCache(studentsData);
      setSelectedDates(getEventDateRange(eventData));
    } catch (err) {
      console.error('Ошибка:', err);
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    window.location.hash = '#events-list';
  };

  const toggleSection = (section) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const toggleDate = (date) => {
    setSelectedDates((prev) => (
      prev.includes(date)
        ? prev.filter((item) => item !== date)
        : [...prev, date]
    ));
  };

  if (loading) {
    return (
      <div className="event-details-page">
        <div className="loading">Загрузка...</div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="event-details-page">
        <div className="loading">Мероприятие не найдено</div>
      </div>
    );
  }

  const eventDates = getEventDateRange(event);
  const hasDateFilter = eventDates.length > 0;
  const allDatesSelected = hasDateFilter
    && eventDates.length === selectedDates.length
    && eventDates.every((date) => selectedDates.includes(date));
  const filteredParticipations = participations.filter((item) => participantMatchesDates(item, selectedDates, hasDateFilter));
  const emptyTextSuffix = allDatesSelected ? 'на мероприятии' : 'за выбранные дни';

  const leaders = filteredParticipations.filter((item) => isRole(item, ['руководитель', 'leader']));
  const organizers = filteredParticipations.filter((item) => isRole(item, ['организатор', 'organizer']));
  const executors = filteredParticipations.filter((item) => isRole(item, ['исполнитель', 'executor']));
  const volunteers = filteredParticipations.filter((item) => isRole(item, ['волонтер', 'волонтёр', 'volunteer']));
  const participants = filteredParticipations.filter((item) => isRole(item, ['участник', 'participant']));
  const knownIds = new Set(
    [...leaders, ...organizers, ...executors, ...volunteers, ...participants]
      .map((item) => item.participation_id)
  );
  const other = filteredParticipations.filter((item) => !knownIds.has(item.participation_id));

  const baseSections = [
    { key: 'leaders', title: 'Руководители', data: leaders, emptyText: `Нет руководителей ${emptyTextSuffix}` },
    { key: 'organizers', title: 'Организаторы', data: organizers, emptyText: `Нет организаторов ${emptyTextSuffix}` },
    { key: 'executors', title: 'Исполнители', data: executors, emptyText: `Нет исполнителей ${emptyTextSuffix}` },
    { key: 'volunteers', title: 'Волонтеры', data: volunteers, emptyText: `Нет волонтеров ${emptyTextSuffix}` },
    { key: 'participants', title: 'Участники', data: participants, emptyText: `Нет участников ${emptyTextSuffix}` },
  ];
  const sections = [
    ...baseSections.filter((section) => section.data.length > 0),
    ...(other.length > 0 ? [{ key: 'other', title: 'Другая роль', data: other, emptyText: `Нет участников с другой ролью ${emptyTextSuffix}` }] : []),
    ...baseSections.filter((section) => section.data.length === 0),
  ];

  const totalParticipants = participations.length;
  const totalFilteredHours = filteredParticipations.reduce(
    (sum, item) => sum + sumParticipationHours(item, selectedDates, hasDateFilter),
    0,
  );
  const activeRoleGroups = baseSections.filter((section) => section.data.length > 0).length + (other.length > 0 ? 1 : 0);
  const eventTypeLabel = event.event_type_name || event.event_type?.event_type_name || 'Тип не указан';

  return (
    <div className={`event-details-page${embedded ? ' event-details-page--embedded' : ''}`}>
      <div className="event-details__container">
        {!embedded ? (
          <button type="button" className="back-link" onClick={goBack}>
            ← Вернуться к списку мероприятий
          </button>
        ) : null}

        <div className="event-info-block">
          <h1 className="event-info-block__title">Информация о мероприятии</h1>
          <div className="event-info-block__row">
            <div className="event-info-block__label">Название</div>
            <div className="event-info-block__value">{event.event_name}</div>
          </div>
          <div className="event-info-block__row">
            <div className="event-info-block__label">Уровень</div>
            <div className="event-info-block__value">{event.event_level || 'Не указан'}</div>
          </div>
          <div className="event-info-block__row">
            <div className="event-info-block__label">Тип</div>
            <div className="event-info-block__value">{eventTypeLabel}</div>
          </div>
          <div className="event-info-block__row">
            <div className="event-info-block__label">Дата начала</div>
            <div className="event-info-block__value">
              {event.start_date ? new Date(event.start_date).toLocaleDateString('ru-RU') : '—'}
            </div>
          </div>
          <div className="event-info-block__row">
            <div className="event-info-block__label">Количество участников</div>
            <div className="event-info-block__value">{totalParticipants}</div>
          </div>
          {event.event_comment ? (
            <div className="event-info-block__row event-info-block__row--comment">
              <div className="event-info-block__label">Описание</div>
              <div className="event-info-block__value">{event.event_comment}</div>
            </div>
          ) : null}
        </div>

        <div className="event-stats-strip">
          <div className="event-stats-strip__item">
            <span className="event-stats-strip__value">{totalParticipants}</span>
            <span className="event-stats-strip__label">участников</span>
          </div>
          <div className="event-stats-strip__item">
            <span className="event-stats-strip__value">
              {totalFilteredHours.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}
            </span>
            <span className="event-stats-strip__label">часов</span>
          </div>
          <div className="event-stats-strip__item">
            <span className="event-stats-strip__value">{activeRoleGroups}</span>
            <span className="event-stats-strip__label">ролей</span>
          </div>
          <div className="event-stats-strip__item">
            <span className="event-stats-strip__value">{selectedDates.length || eventDates.length || 1}</span>
            <span className="event-stats-strip__label">дней</span>
          </div>
        </div>

        <div className="participants-block">
          <div className="participants-block__top">
            <h2 className="participants-block__title">Участники</h2>
            {!embedded ? (
              <a className="participants-block__documents-link" href={`#documents-spravki?event_id=${eventId}`}>
                Перейти к документам мероприятия
              </a>
            ) : null}
          </div>

          {eventDates.length > 0 && (
            <div className="participants-filter">
              <div className="participants-filter__title">Дни участия</div>
              <div className="participants-filter__options">
                <button
                  type="button"
                  className={`participants-filter__all ${allDatesSelected ? 'participants-filter__all--active' : ''}`}
                  onClick={() => setSelectedDates(allDatesSelected ? [] : eventDates)}
                >
                  Все дни
                </button>
                {eventDates.map((date) => (
                  <label key={date} className="participants-filter__option">
                    <input
                      type="checkbox"
                      checked={selectedDates.includes(date)}
                      onChange={() => toggleDate(date)}
                    />
                    <span>{formatRuDateShort(date)}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {sections.map((section) => (
            <div key={section.key} className="participant-group">
              {section.data.length === 0 ? (
                <div className="participant-group__empty-role">
                  {section.emptyText}
                </div>
              ) : (
                <>
                  <div className="participant-group__header" onClick={() => toggleSection(section.key)}>
                    <div className="participant-group__title-wrapper">
                      <h3 className="participant-group__title">{section.title}</h3>
                      <span className="participant-group__count">{section.data.length} чел.</span>
                    </div>
                    <button type="button" className="participant-group__toggle">
                      <svg
                        className={`toggle-icon ${expandedSections[section.key] ? 'expanded' : ''}`}
                        viewBox="0 0 24 24"
                        width="20"
                        height="20"
                        fill="none"
                      >
                        <path
                          d="M6 9L12 15L18 9"
                          stroke="#005BAA"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  </div>

                  {expandedSections[section.key] && (
                    <div className="participant-group__content">
                      {section.data.map((item) => {
                        const student = studentsCache.find((cachedStudent) => cachedStudent.student_id === item.student_id);
                        const fullName = getStudentFullName(student) || `ID ${item.student_id}`;
                        const phone = formatPhone(student?.phone) || '—';

                        return (
                          <div key={item.participation_id} className="participant-item">
                            <div className="participant-item__fio">{fullName}</div>
                            <div className="participant-item__hours-block">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#005BAA" strokeWidth="2">
                                <circle cx="12" cy="12" r="10" />
                                <polyline points="12 6 12 12 16 14" />
                              </svg>
                              <span>{formatHoursMinutes(sumParticipationHours(item, selectedDates, hasDateFilter), '0 \u0447.')}</span>
                            </div>
                            <div className="participant-item__phone">{phone}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default EventDetailsPage;
