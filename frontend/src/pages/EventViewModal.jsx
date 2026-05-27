import { useState, useEffect } from 'react';
import { getEventType, listEventParticipants, listStudents } from '../lib/api.js';
import { formatPhone } from '../lib/participantUtils.js';
import { downloadSpravkaForStudent } from '../lib/spravkaUtils.js';
import {
  formatRuDateShort,
  formatTimeDisplay,
} from '../lib/eventScheduleUtils.js';
import '../components/EventParticipantFields.css';
import './EventCreatePage.css';

function getStudentName(student) {
  return [student?.last_name, student?.first_name, student?.middle_name].filter(Boolean).join(' ');
}

function getTimeSlotsText(timeSlots) {
  const parts = (timeSlots || [])
    .map((slot) => {
      const date = formatRuDateShort(slot.participation_date);
      const start = formatTimeDisplay(slot.start_time);
      const end = formatTimeDisplay(slot.end_time);
      const hours = Number(slot.participation_hours || 0);
      const hoursText = hours > 0 ? `, ${hours.toLocaleString('ru-RU')} ч.` : '';
      return date && start && end ? `${date}: ${start}–${end}${hoursText}` : '';
    })
    .filter(Boolean);

  return parts.join('; ');
}

export function EventViewModal({ event, onClose }) {
  const [isParticipantsExpanded, setIsParticipantsExpanded] = useState(true);
  const [eventTypeName, setEventTypeName] = useState('—');
  const [participants, setParticipants] = useState([]);
  const [studentsById, setStudentsById] = useState({});
  const [spravkaLoadingStudentId, setSpravkaLoadingStudentId] = useState(null);
  const [spravkaError, setSpravkaError] = useState('');

  // Загружаем название типа мероприятия
  useEffect(() => {
    if (event?.event_type_name) {
      setEventTypeName(event.event_type_name);
      return;
    }
    async function loadEventType() {
      if (event?.event_type_id) {
        try {
          const type = await getEventType(event.event_type_id);
          setEventTypeName(type.event_type_name);
        } catch (err) {
          console.error('Не удалось загрузить тип мероприятия:', err);
          setEventTypeName('—');
        }
      } else {
        setEventTypeName('—');
      }
    }
    loadEventType();
  }, [event]);

  useEffect(() => {
    let isMounted = true;

    async function loadParticipants() {
      if (!event?.event_id) return;

      try {
        const [eventParticipants, students] = await Promise.all([
          listEventParticipants(event.event_id),
          listStudents({ limit: 200, isActive: true }),
        ]);

        if (!isMounted) return;

        setParticipants(eventParticipants);
        setStudentsById(
          students.reduce((acc, student) => {
            acc[student.student_id] = student;
            return acc;
          }, {})
        );
      } catch (err) {
        console.error('Не удалось загрузить участников мероприятия:', err);
        if (isMounted) {
          setParticipants([]);
          setStudentsById({});
        }
      }
    }

    loadParticipants();
    return () => { isMounted = false; };
  }, [event]);

  async function handleCreateSpravka(participant) {
    if (!event?.event_id || !participant?.student_id) {
      return;
    }

    setSpravkaLoadingStudentId(participant.student_id);
    setSpravkaError('');
    try {
      await downloadSpravkaForStudent({
        studentId: participant.student_id,
        eventId: event.event_id,
      });
    } catch (err) {
      setSpravkaError(err instanceof Error ? err.message : 'Не удалось сформировать справку.');
    } finally {
      setSpravkaLoadingStudentId(null);
    }
  }

  if (!event) return null;

  const hasDailySchedule = Array.isArray(event.event_daily_schedule)
    && event.event_daily_schedule.some((r) => r.start_time && r.end_time);

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="event-create-page" style={{ padding: 0 }}>
          <div className="event-create-page__hero" style={{ 
            display: 'flex', 
            flexDirection: 'row', 
            justifyContent: 'space-between', 
            alignItems: 'center' 
          }}>
            <h1 className="event-create-page__title">Мероприятие</h1>
            
            <button 
              className="modal-close-btn" 
              onClick={onClose} 
              title="Закрыть"
              style={{ 
                position: 'static',
                fontSize: '32px', 
                padding: '0 10px'
              }}
            >
              ✕
            </button>
          </div>

          <div className="event-create-page__form">
            <div className="form-section">
              <div className="events-form__grid">
                <div className="events-form__field">
                  <label className="events-form__label">Название</label>
                  <input className="events-form__control" value={event.event_name} readOnly />
                </div>
                <div className="events-form__field">
                  <label className="events-form__label">Уровень</label>
                  <input className="events-form__control" value={event.event_level} readOnly />
                </div>
                <div className="events-form__field">
                  <label className="events-form__label">Тип мероприятия</label>
                  <input className="events-form__control" value={eventTypeName} readOnly />
                </div>
                <div className="events-form__field">
                  <label className="events-form__label">Организатор</label>
                  <input className="events-form__control" value={event.organizer_name || '—'} readOnly />
                </div>
                <div className="events-form__field">
                  <label className="events-form__label">Дата начала</label>
                  <input className="events-form__control" value={formatRuDateShort(event.start_date)} readOnly />
                </div>
                <div className="events-form__field">
                  <label className="events-form__label">Дата окончания</label>
                  <input className="events-form__control" value={event.end_date ? formatRuDateShort(event.end_date) : '—'} readOnly />
                </div>
                <div className="events-form__field" style={{ gridColumn: '1 / -1' }}>
                  <label className="events-form__label">Расписание по дням</label>
                  {hasDailySchedule ? (
                    <div className="event-view-schedule-lines">
                      {event.event_daily_schedule.map((row) => {
                        if (!row.start_time || !row.end_time) return null;
                        const line = `${formatRuDateShort(row.date)}: ${formatTimeDisplay(row.start_time)}–${formatTimeDisplay(row.end_time)}`;
                        return (
                          <div key={String(row.date)} className="event-view-schedule-line">{line}</div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="events-form__control" style={{ background: '#f9f9f9' }}>
                      {formatTimeDisplay(event.start_time)}
                      {event.end_time ? ` — ${formatTimeDisplay(event.end_time)}` : ''}
                      {!event.start_time && !event.end_time ? '—' : ''}
                    </div>
                  )}
                </div>
                <div className="events-form__field">
                  <label className="events-form__label">Количество участников</label>
                  {/* ✅ ИСПРАВЛЕНО: показываем реальное количество участников */}
                  <input className="events-form__control" value={participants.length} readOnly />
                </div>
                <div className="events-form__field">
                  <label className="events-form__label">Общее время мероприятия в часах</label>
                  <input className="events-form__control" value={event.duration_hours || '—'} readOnly />
                </div>
                <div className="events-form__field" style={{ gridColumn: '1 / -1' }}>
                  <label className="events-form__label">Комментарий</label>
                  <textarea className="events-form__control" value={event.event_comment || '—'} readOnly rows="3" />
                </div>
              </div>
            </div>

            <div className="participants-section">
              <div className="participants-section__header" onClick={() => setIsParticipantsExpanded(!isParticipantsExpanded)}>
                <h2 className="participants-section__title">Участники</h2>
                <div className="participants-section__toggle">
                  <svg className={`participants-section__toggle-icon ${isParticipantsExpanded ? 'participants-section__toggle-icon--expanded' : ''}`} width="16" height="10" viewBox="0 0 16 10" fill="none">
                    <path d="M1 1L8 8L15 1" stroke="#005BAA" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </div>
              {isParticipantsExpanded && (
                <div className="participants-table">
                  {spravkaError ? (
                    <p className="participants-table__spravka-error">{spravkaError}</p>
                  ) : null}
                  <div className="participants-section__count">Всего: {participants.length}</div>
                  {participants.length === 0 ? (
                    <div className="participants-table__empty">Участники пока не привязаны.</div>
                  ) : (
                    participants.map((participant) => {
                      const student = studentsById[participant.student_id];
                      const timeSlotsText = getTimeSlotsText(participant.time_slots);
                      return (
                        <div className="participant-card" key={participant.participation_id}>
                          <div className="participant-card__main">
                            <input className="participant-card__fio" value={getStudentName(student) || `ID ${participant.student_id}`} readOnly />
                            <input className="participant-card__role" value={participant.role_name} readOnly />
                            <input className="participant-card__phone" value={formatPhone(student?.phone) || '—'} readOnly />
                          </div>
                          {timeSlotsText || participant.notes ? (
                            <div className="participant-card__time">
                              <span className="participant-card__duration-text">{timeSlotsText || participant.notes}</span>
                            </div>
                          ) : null}
                          {participant.student_id ? (
                            <div className="participant-card__spravka-wrap">
                              <button
                                type="button"
                                className="spravka-btn"
                                disabled={String(spravkaLoadingStudentId) === String(participant.student_id)}
                                onClick={() => handleCreateSpravka(participant)}
                              >
                                {String(spravkaLoadingStudentId) === String(participant.student_id)
                                  ? 'Формирование...'
                                  : 'Создать справку'}
                              </button>
                            </div>
                          ) : null}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
