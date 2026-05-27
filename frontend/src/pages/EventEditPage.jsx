import { useState, useEffect, useRef } from 'react';
import {
  createEventParticipant,
  createEventType,
  deleteEventParticipant,
  getEvent,
  listEventParticipants,
  listEventTypes,
  listStudents,
  updateEvent,
  updateEventParticipant,
} from '../lib/api.js';
import { ParticipantCard } from '../components/EventParticipantFields.jsx';
import { EventDayScheduleEditor } from '../components/EventDayScheduleEditor.jsx';
import {
  apiTimeSlotsToParticipant,
  getParticipantValidationMessages,
  getStudentFullName,
  normalizePhoneDigits,
  participantTimeSlotsToApi,
  resolveParticipantStudentId,
} from '../lib/participantUtils.js';
import {
  apiScheduleToRows,
  enumerateEventDates,
  mergeScheduleWithDates,
  scheduleRowsToApi,
  sumScheduleHours,
} from '../lib/eventScheduleUtils.js';
import { downloadSpravkaForStudent } from '../lib/spravkaUtils.js';
import './EventCreatePage.css';

const eventLevelOptions = [
  'Всероссийский',
  'Региональный',
  'Городской',
  'Университетский',
  'Институтский',
];

function hasValue(value) {
  return value !== null && value !== undefined && value !== '';
}

function getValidationMessages(formData) {
  const messages = [];
  if (!hasValue(formData.event_name)) messages.push('Укажите название.');
  if (!hasValue(formData.event_level)) messages.push('Выберите уровень.');
  if (!hasValue(formData.start_date)) messages.push('Укажите дату начала.');
  return messages;
}

function FormField({ label, name, value, onChange, required = false, type = 'text', placeholder = '', as = 'input', options = [], disabled = false }) {
  const commonProps = { className: 'events-form__control', id: name, name, value, onChange, required, placeholder, disabled };
  return (
    <div className="events-form__field">
      <label className="events-form__label" htmlFor={name}>{label}{required && <span className="events-form__required">*</span>}</label>
      {as === 'select' ? (
        <select {...commonProps}><option value="">Выберите значение</option>{options.map((o) => <option key={o} value={o}>{o}</option>)}</select>
      ) : as === 'textarea' ? (
        <textarea {...commonProps} rows="3" />
      ) : (
        <input {...commonProps} type={type} />
      )}
    </div>
  );
}

function EventTypeInput({ value, eventTypesList, onSelectEventType, onChange }) {
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef(null);

  function getSuggestions(searchValue = '') {
    if (!eventTypesList || eventTypesList.length === 0) return [];
    const search = searchValue.toLowerCase().trim();
    if (!search) return eventTypesList;
    return eventTypesList.filter((et) => (et.event_type_name || '').toLowerCase().includes(search));
  }

  function openSuggestions(searchValue = value) {
    const nextSuggestions = getSuggestions(searchValue);
    setSuggestions(nextSuggestions);
    setShowSuggestions(nextSuggestions.length > 0);
  }

  function handleChange(e) {
    onChange(e.target.value);
    openSuggestions(e.target.value);
  }

  function handleSelect(eventType) {
    onChange(eventType.event_type_name);
    onSelectEventType({ eventTypeId: eventType.event_type_id, eventTypeName: eventType.event_type_name });
    setShowSuggestions(false);
    setSuggestions([]);
  }

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="student-input-wrapper" ref={wrapperRef}>
      <input
        className="events-form__control"
        type="text"
        placeholder="Тип мероприятия"
        value={value}
        onChange={handleChange}
        onFocus={() => openSuggestions()}
        onClick={() => openSuggestions()}
        autoComplete="off"
      />
      {showSuggestions && suggestions.length > 0 && (
        <ul className="student-suggestions">
          {suggestions.map((et) => (
            <li key={et.event_type_id} className="student-suggestion-item" onClick={() => handleSelect(et)}>
              {et.event_type_name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function EventEditPage() {
  const [formData, setFormData] = useState({
    event_name: '',
    event_level: '',
    event_type: '',
    organizer_name: '',
    start_date: '',
    end_date: '',
    duration_hours: '',
    event_comment: '',
  });
  const [participants, setParticipants] = useState([]);
  const [scheduleRows, setScheduleRows] = useState([]);
  const [isParticipantsExpanded, setIsParticipantsExpanded] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [eventId, setEventId] = useState(null);
  const [eventTypesCache, setEventTypesCache] = useState([]);
  const [eventData, setEventData] = useState(null);
  const [studentsCache, setStudentsCache] = useState([]);
  const [spravkaLoadingStudentId, setSpravkaLoadingStudentId] = useState(null);

  useEffect(() => {
    const hash = window.location.hash;
    const queryString = hash.includes('?') ? hash.split('?')[1] : window.location.search;
    const params = new URLSearchParams(queryString);
    const id = params.get('id');
    if (id) {
      setEventId(Number(id));
    } else {
      setError('Не указан ID мероприятия');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function loadStudents() {
      try {
        const data = await listStudents({ limit: 200, isActive: true });
        if (isMounted) setStudentsCache(data);
      } catch (err) {
        console.error('Не удалось загрузить список студентов:', err);
      }
    }
    loadStudents();
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function loadEventTypes() {
      try {
        const data = await listEventTypes({ limit: 200, isActive: true });
        if (isMounted) setEventTypesCache(data);
      } catch (err) {
        console.error('Не удалось загрузить типы мероприятий:', err);
      }
    }
    loadEventTypes();
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    if (!eventId) return;

    async function loadEvent() {
      try {
        setLoading(true);
        setError('');
        const event = await getEvent(eventId);
        setEventData(event);

        const formatTimeForInput = (isoString) => {
          if (!isoString) return '';
          if (typeof isoString === 'string' && /^\d{2}:\d{2}/.test(isoString)) {
            return isoString.slice(0, 5);
          }
          return new Date(isoString).toTimeString().slice(0, 5);
        };

        const formatDateForInput = (isoString) => {
          if (!isoString) return '';
          return new Date(isoString).toISOString().split('T')[0];
        };

        setFormData({
          event_name: event.event_name || '',
          event_level: event.event_level || '',
          event_type: '',
          organizer_name: event.organizer_name || '',
          start_date: formatDateForInput(event.start_date),
          end_date: formatDateForInput(event.end_date),
          duration_hours: event.duration_hours || '',
          event_comment: event.event_comment || '',
        });

        const startD = formatDateForInput(event.start_date);
        const endD = formatDateForInput(event.end_date) || startD;
        const dates = enumerateEventDates(startD, endD);
        const fromApi = apiScheduleToRows(event.event_daily_schedule);
        if (fromApi.length > 0) {
          setScheduleRows(mergeScheduleWithDates(dates, fromApi));
        } else {
          const st = formatTimeForInput(event.start_time);
          const et = formatTimeForInput(event.end_time);
          setScheduleRows(dates.map((d) => ({ date: d, start: st, end: et })));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Не удалось загрузить данные мероприятия');
      } finally {
        setLoading(false);
      }
    }

    loadEvent();
  }, [eventId]);

  useEffect(() => {
    if (!eventId) return;

    let isMounted = true;
    async function loadParticipants() {
      try {
        const data = await listEventParticipants(eventId);
        if (!isMounted) return;

        setParticipants(
          data.map((participant) => {
            const student = studentsCache.find((item) => item.student_id === participant.student_id);
            return {
              ...participant,
              id: participant.participation_id,
              participation_id: participant.participation_id,
              fio: getStudentFullName(student) || `ID ${participant.student_id}`,
              role: participant.role_name,
              phone: student?.phone ? normalizePhoneDigits(student.phone) : '',
              student_id: participant.student_id,
              isPersisted: true,
              timeSlots: apiTimeSlotsToParticipant(participant.time_slots),
            };
          }),
        );
      } catch (err) {
        console.error('Не удалось загрузить участников мероприятия:', err);
      }
    }

    loadParticipants();
    return () => { isMounted = false; };
  }, [eventId, studentsCache]);

  useEffect(() => {
    if (eventData && eventTypesCache.length > 0 && eventData.event_type_id) {
      const type = eventTypesCache.find((et) => et.event_type_id === eventData.event_type_id);
      if (type) {
        setFormData((prev) => ({ ...prev, event_type: type.event_type_name }));
      }
    }
  }, [eventData, eventTypesCache]);

  useEffect(() => {
    const end = formData.end_date || formData.start_date;
    const dates = enumerateEventDates(formData.start_date, end);
    if (dates.length === 0) {
      setScheduleRows([]);
      return;
    }
    setScheduleRows((prev) => mergeScheduleWithDates(dates, prev));
  }, [formData.start_date, formData.end_date]);

  useEffect(() => {
    const fromSchedule = sumScheduleHours(scheduleRows);
    if (fromSchedule > 0) {
      setFormData((prev) => ({ ...prev, duration_hours: String(fromSchedule) }));
      return;
    }

    const start = formData.start_date;
    const end = formData.end_date || formData.start_date;
    if (!start || !end) return;

    const startDateOnly = new Date(start);
    const endDateOnly = new Date(end);
    startDateOnly.setHours(0, 0, 0, 0);
    endDateOnly.setHours(0, 0, 0, 0);

    const daysDiff = Math.floor((endDateOnly - startDateOnly) / (1000 * 60 * 60 * 24)) + 1;
    const calculatedDuration = daysDiff * 8;

    if (!Number.isNaN(calculatedDuration)) {
      setFormData((prev) => ({ ...prev, duration_hours: calculatedDuration.toString() }));
    }
  }, [scheduleRows, formData.start_date, formData.end_date]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  async function resolveEventTypeId(typeName) {
    if (!typeName) return null;
    const existing = eventTypesCache.find((et) => et.event_type_name.toLowerCase() === typeName.toLowerCase());
    if (existing) return existing.event_type_id;

    try {
      const newType = await createEventType({
        event_type_name: typeName,
        description: null,
        is_active: true,
      });
      setEventTypesCache((prev) => [...prev, newType]);
      return newType.event_type_id;
    } catch (err) {
      console.error('Не удалось создать тип:', err);
      return null;
    }
  }

  async function handleCreateSpravka(participant) {
    if (!eventId || !participant?.student_id) {
      return;
    }

    setSpravkaLoadingStudentId(participant.student_id);
    setError('');
    try {
      await downloadSpravkaForStudent({
        studentId: participant.student_id,
        eventId,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сформировать справку.');
    } finally {
      setSpravkaLoadingStudentId(null);
    }
  }

  function addParticipant() {
    setParticipants((prev) => [
      ...prev,
      { id: Date.now(), fio: '', role: 'Участник', phone: '', student_id: null, isPersisted: false, timeSlots: [] },
    ]);
    setIsParticipantsExpanded(true);
  }

  function updateParticipant(index, updatedParticipant) {
    setParticipants((prev) => prev.map((p, i) => (i === index ? updatedParticipant : p)));
  }

  function addTimeSlot(index) {
    setParticipants((prev) => prev.map((p, i) => (i === index ? { ...p, timeSlots: [...p.timeSlots, { date: '', start: '', end: '' }] } : p)));
  }

  function removeTimeSlot(index, slotIdx) {
    setParticipants((prev) => prev.map((p, i) => (i === index ? { ...p, timeSlots: p.timeSlots.filter((_, si) => si !== slotIdx) } : p)));
  }

  function updateTimeSlot(index, slotIdx, field, value) {
    setParticipants((prev) => prev.map((p, i) => {
      if (i !== index) return p;
      const newSlots = [...p.timeSlots];
      newSlots[slotIdx] = { ...newSlots[slotIdx], [field]: value };
      return { ...p, timeSlots: newSlots };
    }));
  }

  async function handleRemoveParticipant(index) {
    const participant = participants[index];
    if (!participant) return;

    if (participant.isPersisted && participant.participation_id) {
      try {
        await deleteEventParticipant(eventId, participant.participation_id);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Не удалось удалить участника.');
        return;
      }
    }

    setParticipants((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  }

  const handleSubmit = async (e) => {
    e.preventDefault();

    const newParticipants = participants.filter((participant) => !participant.isPersisted);
    const validationMessages = [
      ...getValidationMessages(formData),
      ...getParticipantValidationMessages(newParticipants),
    ];
    if (validationMessages.length > 0) {
      setError(validationMessages.join(' '));
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const eventTypeId = await resolveEventTypeId(formData.event_type?.trim());

      const endDateFinal = formData.end_date || formData.start_date;
      const scheduleApi = scheduleRowsToApi(scheduleRows);

      const payload = {
        event_name: formData.event_name.trim(),
        event_level: formData.event_level,
        event_type_id: eventTypeId,
        organizer_name: formData.organizer_name?.trim() || null,
        start_date: formData.start_date || null,
        end_date: endDateFinal || null,
        participants_planned: participants.length,
        duration_hours: formData.duration_hours ? parseFloat(formData.duration_hours) : null,
        event_comment: formData.event_comment?.trim() || null,
        event_daily_schedule: scheduleApi.length > 0 ? scheduleApi : null,
      };

      if (scheduleApi.length > 0) {
        payload.start_time = null;
        payload.end_time = null;
      }

      await updateEvent(eventId, payload);

      const persistedParticipants = participants.filter((participant) => participant.isPersisted && participant.participation_id);
      for (const participant of persistedParticipants) {
        await updateEventParticipant(eventId, participant.participation_id, {
          role_name: participant.role || 'Участник',
          time_slots: participantTimeSlotsToApi(participant),
        });
      }

      let updatedStudentsCache = [...studentsCache];
      for (const participant of newParticipants) {
        const studentId = await resolveParticipantStudentId(participant, updatedStudentsCache);
        const created = await createEventParticipant(eventId, {
          student_id: studentId,
          role_name: participant.role || 'Участник',
          participation_status: 'planned',
          notes: null,
          time_slots: participantTimeSlotsToApi(participant),
        });

        const student = updatedStudentsCache.find((item) => item.student_id === studentId);
        setParticipants((prev) => prev.map((item) => (
          item.id === participant.id
            ? {
                ...item,
                ...created,
                participation_id: created.participation_id,
                student_id: studentId,
                fio: getStudentFullName(student) || item.fio,
                role: created.role_name,
                isPersisted: true,
              }
            : item
        )));

        if (!student) {
          const freshStudents = await listStudents({ limit: 200, isActive: true });
          updatedStudentsCache = freshStudents;
          setStudentsCache(freshStudents);
        }
      }

      window.location.hash = 'events-list';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить изменения');
    } finally {
      setIsSubmitting(false);
    }
  };

  const validationMessages = getValidationMessages(formData);
  const isValid = validationMessages.length === 0;

  if (loading) {
    return (
      <div className="event-create-page">
        <div className="loading-state">Загрузка данных мероприятия...</div>
      </div>
    );
  }

  if (!eventId && error) {
    return (
      <div className="event-create-page">
        <div className="error-message" style={{ margin: '20px' }}>
          <p>Ошибка: {error}</p>
          <button type="button" onClick={() => { window.location.hash = 'events-list'; }} className="retry-button">
            Вернуться к списку
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="event-create-page">
      <div className="event-create-page__hero">
        <a className="event-create-page__back-link" href="#events-list" onClick={(e) => { e.preventDefault(); window.location.hash = 'events-list'; }}>
          ← К списку мероприятий
        </a>
        <h1 className="event-create-page__title">Редактирование мероприятия</h1>
      </div>

      {error && (
        <div className="error-message" style={{ margin: '20px' }}>
          {error}
          <button type="button" onClick={() => setError('')} className="retry-button">Закрыть</button>
        </div>
      )}

      <form className="event-create-page__form" onSubmit={handleSubmit}>
        <div className="form-section">
          <div className="events-form__grid">
            <FormField label="Название" name="event_name" value={formData.event_name} onChange={handleChange} required />
            <FormField label="Уровень" name="event_level" value={formData.event_level} onChange={handleChange} as="select" options={eventLevelOptions} required />

            <div className="events-form__field">
              <label className="events-form__label" htmlFor="event_type">Тип мероприятия</label>
              <EventTypeInput
                value={formData.event_type}
                eventTypesList={eventTypesCache}
                onChange={(val) => setFormData((prev) => ({ ...prev, event_type: val }))}
                onSelectEventType={() => {}}
              />
            </div>

            <FormField label="Организатор" name="organizer_name" value={formData.organizer_name} onChange={handleChange} placeholder="ФИО" />
            <FormField label="Дата начала" name="start_date" value={formData.start_date} onChange={handleChange} type="date" required />
            <FormField label="Дата окончания" name="end_date" value={formData.end_date} onChange={handleChange} type="date" />
            <EventDayScheduleEditor rows={scheduleRows} onRowsChange={setScheduleRows} />
            <FormField label="Количество участников" name="participants_planned" value={participants.length} disabled />
            <FormField label="Длительность (общее время мероприятия, ч)" name="duration_hours" value={formData.duration_hours} onChange={handleChange} disabled placeholder="0 ч." />
            <FormField label="Комментарий" name="event_comment" value={formData.event_comment} onChange={handleChange} as="textarea" />
          </div>
        </div>

        <div className="participants-section">
          <div
            className="participants-section__header participants-section__header--clickable"
            onClick={() => setIsParticipantsExpanded(!isParticipantsExpanded)}
          >
            <h2 className="participants-section__title">Участники</h2>
            <button type="button" className="participants-section__toggle">
              <svg className={`participants-section__toggle-icon ${isParticipantsExpanded ? 'participants-section__toggle-icon--expanded' : ''}`} width="16" height="10" viewBox="0 0 16 10" fill="none">
                <path d="M1 1L8 8L15 1" stroke="#005BAA" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          {isParticipantsExpanded && (
            <>
              <div className="participants-section__count">Всего: {participants.length}</div>
              <div className="participants-table">
                {participants.length === 0 ? (
                  <div className="participants-table__empty">Список участников пуст. Нажмите «+» чтобы добавить.</div>
                ) : (
                  participants.map((participant, idx) => (
                    <ParticipantCard
                      key={participant.participation_id || participant.id}
                      participant={participant}
                      index={idx}
                      studentsList={studentsCache}
                      readOnlyIdentity={participant.isPersisted}
                      showTimeSlots
                      onCreateSpravka={participant.isPersisted && participant.student_id ? handleCreateSpravka : undefined}
                      spravkaLoadingStudentId={spravkaLoadingStudentId}
                      onRemove={handleRemoveParticipant}
                      onAddTimeSlot={addTimeSlot}
                      onRemoveTimeSlot={removeTimeSlot}
                      onUpdateTimeSlot={updateTimeSlot}
                      onUpdateParticipant={updateParticipant}
                    />
                  ))
                )}
              </div>
              <div className="participants-section__plus-container">
                <button type="button" className="participants-section__plus-btn" onClick={addParticipant} aria-label="Добавить участника">
                  <div className="participants-section__plus-horizontal" />
                  <div className="participants-section__plus-vertical" />
                </button>
              </div>
            </>
          )}
        </div>

        <div className="form-actions">
          <div className={`form-validation form-validation--${isValid ? 'ready' : 'error'}`}>
            <span className="form-validation__title">{isValid ? 'Можно сохранить изменения' : 'Что нужно исправить'}</span>
            <p className="form-validation__text">{isValid ? 'Все обязательные данные заполнены.' : validationMessages.join(' ')}</p>
          </div>
          <button className="form-submit" type="submit" disabled={!isValid || isSubmitting}>
            {isSubmitting ? 'Сохранение...' : 'Сохранить изменения'}
          </button>
        </div>
      </form>
    </div>
  );
}
