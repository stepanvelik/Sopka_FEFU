import { useState, useEffect, useRef } from 'react';
import { createEvent, createEventParticipant, listStudents, listEventTypes, createEventType } from '../lib/api.js';
import { ParticipantCard } from '../components/EventParticipantFields.jsx';
import { EventDayScheduleEditor } from '../components/EventDayScheduleEditor.jsx';
import { FormActionBar } from '../components/ui/FormActionBar.jsx';
import {
  getParticipantValidationMessages,
  participantTimeSlotsToApi,
  resolveParticipantStudentId,
} from '../lib/participantUtils.js';
import {
  enumerateEventDates,
  mergeScheduleWithDates,
  scheduleRowsToApi,
  sumScheduleHours,
} from '../lib/eventScheduleUtils.js';
import './EventCreatePage.css';

const eventLevelOptions = [
  'Всероссийский',
  'Региональный',
  'Городской',
  'Университетский',
  'Институтский',
];

const initialFormState = {
  event_name: '',
  event_level: '',
  event_type: '',
  organizer_name: '',
  start_date: '',
  end_date: '',
  participants_planned: '',
  duration_hours: '',
  event_comment: '',
};

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

function FormField({ label, name, value, onChange, required = false, type = 'text', placeholder = '', as = 'input', options = [], disabled = false, step }) {
  const commonProps = { className: 'events-form__control', id: name, name, value, onChange, required, placeholder, disabled };
  return (
    <div className="events-form__field">
      <label className="events-form__label" htmlFor={name}>
        {label}{required && <span className="events-form__required">*</span>}
      </label>
      {as === 'select' ? (
        <select {...commonProps}>
          <option value="">Выберите значение</option>
          {options.map((option) => (<option key={option} value={option}>{option}</option>))}
        </select>
      ) : as === 'textarea' ? (
        <textarea {...commonProps} rows="3" />
      ) : (
        <input {...commonProps} type={type} step={step} />
      )}
    </div>
  );
}

function EventTypeInput({ value, eventTypesList, onSelectEventType, onChange }) {
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef(null);

  function getSuggestions(searchValue = '') {
    if (!eventTypesList || eventTypesList.length === 0) {
      return [];
    }

    const search = searchValue.toLowerCase().trim();
    if (!search) {
      return eventTypesList;
    }

    return eventTypesList.filter((et) => (et.event_type_name || '').toLowerCase().includes(search));
  }

  function openSuggestions(searchValue = value) {
    const nextSuggestions = getSuggestions(searchValue);
    setSuggestions(nextSuggestions);
    setShowSuggestions(nextSuggestions.length > 0);
  }

  function handleChange(e) {
    const val = e.target.value;
    onChange(val);
    openSuggestions(val);
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

export function EventCreatePage() {
  const [formData, setFormData] = useState(initialFormState);
  const [participants, setParticipants] = useState([]);
  const [studentsCache, setStudentsCache] = useState([]);
  const [eventTypesCache, setEventTypesCache] = useState([]);
  const [scheduleRows, setScheduleRows] = useState([]);
  const [isParticipantsExpanded, setIsParticipantsExpanded] = useState(false);
  const [status, setStatus] = useState({ type: 'error', messages: [] });
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    setFormData((prev) => ({ ...prev, participants_planned: participants.length.toString() }));
  }, [participants]);

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
      setFormData((prev) => ({
        ...prev,
        duration_hours: calculatedDuration.toString(),
      }));
    }
  }, [scheduleRows, formData.start_date, formData.end_date]);

  function handleChange(event) {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  function addParticipant() {
    setParticipants((prev) => [...prev, { id: Date.now(), fio: '', role: 'Участник', phone: '', student_id: null, timeSlots: [] }]);
    setIsParticipantsExpanded(true);
  }

  function removeParticipant(index) {
    setParticipants((prev) => prev.filter((_, i) => i !== index));
  }

  function updateParticipant(index, updatedParticipant) {
    setParticipants((prev) => prev.map((p, i) => (i === index ? updatedParticipant : p)));
  }

  function addTimeSlot(index) {
    setParticipants((prev) => prev.map((p, i) => {
      if (i !== index) return p;
      const usedDates = new Set((p.timeSlots || []).map((s) => s.date));
      const nextRow = scheduleRows.find((row) => row.date && !usedDates.has(row.date));
      if (!nextRow) {
        return p;
      }
      const newSlot = { date: nextRow.date, start: nextRow.start || '', end: nextRow.end || '' };
      return { ...p, timeSlots: [...p.timeSlots, newSlot] };
    }));
  }

  function removeTimeSlot(index, slotIdx) {
    setParticipants((prev) => prev.map((p, i) => (i === index ? { ...p, timeSlots: p.timeSlots.filter((_, si) => si !== slotIdx) } : p)));
  }

  function updateTimeSlot(index, slotIdx, field, value) {
    setParticipants((prev) => prev.map((p, i) => {
      if (i !== index) return p;
      if (field === 'date' && value && !eventDates.includes(value)) return p;
      const newSlots = [...p.timeSlots];
      newSlots[slotIdx] = { ...newSlots[slotIdx], [field]: value };
      return { ...p, timeSlots: newSlots };
    }));
  }

  const eventDates = scheduleRows.map((row) => row.date).filter(Boolean);

  function canSubmit() {
    return getValidationMessages(formData).length === 0
      && getParticipantValidationMessages(participants, { allowedDates: eventDates }).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const validationMessages = [
      ...getValidationMessages(formData),
      ...getParticipantValidationMessages(participants, { allowedDates: eventDates }),
    ];
    if (validationMessages.length > 0) {
      setStatus({ type: 'error', messages: validationMessages });
      return;
    }

    setIsSubmitting(true);
    setStatus({ type: 'idle', messages: [] });

    try {
      let eventTypeId = null;
      const eventTypeName = formData.event_type?.trim();

      if (eventTypeName) {
        const existingType = eventTypesCache.find(
          (et) => et.event_type_name.toLowerCase() === eventTypeName.toLowerCase(),
        );

        if (existingType) {
          eventTypeId = existingType.event_type_id;
        } else {
          try {
            const newType = await createEventType({
              event_type_name: eventTypeName,
              description: null,
              is_active: true,
            });
            eventTypeId = newType.event_type_id;
            setEventTypesCache((prev) => [...prev, newType]);
          } catch (err) {
            console.error('Не удалось создать тип мероприятия:', err);
          }
        }
      }

      const endDateFinal = formData.end_date || formData.start_date;
      const scheduleApi = scheduleRowsToApi(scheduleRows);

      const payload = {
        event_name: formData.event_name.trim(),
        event_level: formData.event_level,
        event_type_id: eventTypeId,
        organizer_name: formData.organizer_name?.trim() || null,
        start_date: formData.start_date || null,
        end_date: endDateFinal || null,
        participants_planned: formData.participants_planned ? parseInt(formData.participants_planned, 10) : null,
        duration_hours: formData.duration_hours ? parseFloat(formData.duration_hours) : null,
        event_comment: formData.event_comment?.trim() || null,
        event_daily_schedule: scheduleApi.length > 0 ? scheduleApi : null,
      };

      if (scheduleApi.length > 0) {
        payload.start_time = null;
        payload.end_time = null;
      }

      const createdEvent = await createEvent(payload);

      let updatedStudentsCache = [...studentsCache];
      for (const participant of participants) {
        const studentId = await resolveParticipantStudentId(participant, updatedStudentsCache);
        const createdStudent = updatedStudentsCache.find((item) => item.student_id === studentId);
        if (!createdStudent) {
          const freshStudents = await listStudents({ limit: 200, isActive: true });
          updatedStudentsCache = freshStudents;
          setStudentsCache(freshStudents);
        }

        await createEventParticipant(createdEvent.event_id, {
          student_id: studentId,
          role_name: participant.role || 'Участник',
          participation_status: 'planned',
          notes: null,
          time_slots: participantTimeSlotsToApi(participant),
        });
      }

      setStatus({ type: 'success', message: 'Мероприятие успешно создано!' });
      setFormData(initialFormState);
      setParticipants([]);
      setScheduleRows([]);
      setIsParticipantsExpanded(false);
      setTimeout(() => setStatus({ type: 'idle', messages: [] }), 2000);
    } catch (err) {
      setStatus({ type: 'error', messages: [err instanceof Error ? err.message : 'Не удалось создать мероприятие.'] });
    } finally {
      setIsSubmitting(false);
    }
  }

  const isValid = canSubmit();
  const validationMessages = [
    ...getValidationMessages(formData),
    ...getParticipantValidationMessages(participants, { allowedDates: eventDates }),
  ];
  const actionValidationMessages = status.type === 'error' && status.messages?.length
    ? status.messages
    : validationMessages;

  return (
    <div className="event-create-page">
      <div className="event-create-page__hero">
        <a className="event-create-page__back-link" href="#">← На главную</a>
        <h1 className="event-create-page__title">Создание мероприятия</h1>
      </div>

      <form className="event-create-page__form" onSubmit={handleSubmit}>
        <div className="form-section">
          <div className="events-form__grid">
            <FormField label="Название" name="event_name" value={formData.event_name} onChange={handleChange} required placeholder="Название" />
            <FormField label="Уровень" name="event_level" value={formData.event_level} onChange={handleChange} required as="select" options={eventLevelOptions} />

            <div className="events-form__field">
              <label className="events-form__label" htmlFor="event_type">Тип мероприятия</label>
              <EventTypeInput
                value={formData.event_type}
                eventTypesList={eventTypesCache}
                onChange={(val) => setFormData((prev) => ({ ...prev, event_type: val }))}
                onSelectEventType={() => {}}
              />
            </div>

            <FormField label="Организация" name="organizer_name" value={formData.organizer_name} onChange={handleChange} />
            <FormField label="Дата начала" name="start_date" value={formData.start_date} onChange={handleChange} type="date" required />
            <FormField label="Дата окончания" name="end_date" value={formData.end_date} onChange={handleChange} type="date" />
            <EventDayScheduleEditor rows={scheduleRows} onRowsChange={setScheduleRows} />
            <FormField label="Количество участников" name="participants_planned" value={formData.participants_planned} onChange={handleChange} type="number" placeholder="0" disabled />
            <FormField label="Общее время мероприятия в часах" name="duration_hours" value={formData.duration_hours} onChange={handleChange} type="number" step="0.5" placeholder="0 ч." disabled />
            <FormField label="Комментарий" name="event_comment" value={formData.event_comment} onChange={handleChange} as="textarea" placeholder="Комментарий" />
          </div>
        </div>

        <div className="participants-section">
          <div
            className="participants-section__header participants-section__header--clickable"
            onClick={() => setIsParticipantsExpanded(!isParticipantsExpanded)}
          >
            <h2 className="participants-section__title">Участники</h2>
            <div className="participants-section__center-slot">
              {!isParticipantsExpanded && (
                <button type="button" className="participants-section__plus-btn" onClick={(e) => { e.stopPropagation(); addParticipant(); }} aria-label="Добавить участника">
                  <div className="participants-section__plus-horizontal" />
                  <div className="participants-section__plus-vertical" />
                </button>
              )}
            </div>
            <button type="button" className="participants-section__toggle" aria-label={isParticipantsExpanded ? 'Свернуть' : 'Развернуть'}>
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
                      key={participant.id}
                      participant={participant}
                      index={idx}
                      studentsList={studentsCache}
                      availableDates={eventDates}
                      onRemove={removeParticipant}
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

        <FormActionBar
          canSubmit={isValid}
          isSubmitting={isSubmitting}
          submitLabel="Создать мероприятие"
          submittingLabel="Создание..."
          cancelHref="#events-list"
          validationMessages={actionValidationMessages}
          successMessage={status.type === 'success' ? status.message : ''}
        />
      </form>
    </div>
  );
}
