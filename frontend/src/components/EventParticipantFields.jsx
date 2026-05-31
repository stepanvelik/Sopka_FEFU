import { useEffect, useRef, useState } from 'react';
import { formatHoursMinutes, formatRuDateShort } from '../lib/eventScheduleUtils.js';
import { formatPhone, normalizePhoneDigits, roleOptions } from '../lib/participantUtils.js';
import './EventParticipantFields.css';

export function StudentNameInput({ value, studentsList, onSelectStudent, onChange, readOnly = false }) {
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef(null);

  function handleChange(e) {
    const val = e.target.value;
    onChange(val);
    if (readOnly) return;

    if (val.length >= 1 && studentsList && studentsList.length > 0) {
      const search = val.toLowerCase().trim();
      const filtered = studentsList
        .filter((student) => {
          const fullName = `${student.last_name || ''} ${student.first_name || ''} ${student.middle_name || ''}`.toLowerCase();
          return fullName.includes(search);
        })
        .slice(0, 10);
      setSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setShowSuggestions(false);
      setSuggestions([]);
    }
  }

  function handleSelect(student) {
    const fullName = `${student.last_name || ''} ${student.first_name || ''} ${student.middle_name || ''}`.trim();
    const phone = student.phone || '';
    onChange(fullName);
    onSelectStudent({
      fullName,
      phone: phone ? phone.toString().replace(/\D/g, '') : '',
      studentId: student.student_id,
    });
    setShowSuggestions(false);
    setSuggestions([]);
  }

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
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
        placeholder="Фамилия Имя Отчество"
        value={value}
        onChange={handleChange}
        autoComplete="off"
        readOnly={readOnly}
      />
      {!readOnly && showSuggestions && suggestions.length > 0 && (
        <ul className="student-suggestions">
          {suggestions.map((student) => (
            <li
              key={student.student_id}
              className="student-suggestion-item"
              onClick={() => handleSelect(student)}
            >
              {student.last_name} {student.first_name} {student.middle_name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TimeSlotInput({ slot, onChange, onRemove, readOnly = false, dateOptions = null }) {
  const hasDateOptions = Array.isArray(dateOptions);
  const isInvalidSelectedDate = hasDateOptions && slot.date && !dateOptions.includes(slot.date);

  return (
    <div className="time-slot-input">
      {hasDateOptions ? (
        <select
          className="time-slot-input__date"
          value={slot.date || ''}
          onChange={(e) => onChange('date', e.target.value)}
          disabled={readOnly || dateOptions.length === 0}
        >
          {!slot.date ? (
            <option value="">
              {dateOptions.length > 0 ? 'Выберите день' : 'Нет дней'}
            </option>
          ) : null}
          {isInvalidSelectedDate ? (
            <option value={slot.date} disabled>
              {slot.date}
            </option>
          ) : null}
          {dateOptions.map((date) => (
            <option key={date} value={date}>
              {formatRuDateShort(date)}
            </option>
          ))}
        </select>
      ) : (
        <input type="date" className="time-slot-input__date" value={slot.date} onChange={(e) => onChange('date', e.target.value)} readOnly={readOnly} />
      )}
      <input type="time" className="time-slot-input__time" value={slot.start} onChange={(e) => onChange('start', e.target.value)} readOnly={readOnly} />
      <span className="time-slot-input__separator">-</span>
      <input type="time" className="time-slot-input__time" value={slot.end} onChange={(e) => onChange('end', e.target.value)} readOnly={readOnly} />
      {!readOnly ? (
        <button type="button" className="time-slot-input__remove" onClick={onRemove}>✕</button>
      ) : null}
    </div>
  );
}

export function ParticipantCard({
  participant,
  index,
  studentsList,
  onRemove,
  onAddTimeSlot,
  onUpdateTimeSlot,
  onRemoveTimeSlot,
  onUpdateParticipant,
  onCreateSpravka,
  spravkaLoadingStudentId = null,
  readOnly = false,
  readOnlyIdentity = false,
  showTimeSlots = true,
  availableDates = null,
}) {
  const identityLocked = readOnly || readOnlyIdentity;
  const timeSlots = participant.timeSlots || [];
  const availableDateOptions = Array.isArray(availableDates)
    ? availableDates.filter(Boolean)
    : null;
  const totalDuration = timeSlots.reduce((sum, slot) => {
    if (slot.start && slot.end) {
      const [sh, sm] = slot.start.split(':').map(Number);
      const [eh, em] = slot.end.split(':').map(Number);
      const diff = (eh * 60 + em) - (sh * 60 + sm);
      return sum + (diff > 0 ? diff : 0);
    }
    return sum;
  }, 0);
  const durationText = formatHoursMinutes(totalDuration / 60, '0 \u0447.');
  const canCreateSpravka = Boolean(onCreateSpravka && participant.student_id);
  const isSpravkaLoading = canCreateSpravka
    && String(spravkaLoadingStudentId) === String(participant.student_id);
  const usedDates = new Set(timeSlots.map((slot) => slot.date).filter(Boolean));
  const canAddTimeSlot = availableDateOptions
    ? availableDateOptions.some((date) => !usedDates.has(date))
    : true;
  const addTimeSlotTitle = availableDateOptions
    ? (availableDateOptions.length === 0
        ? 'Сначала укажите даты мероприятия'
        : (canAddTimeSlot ? 'Добавить день участия' : 'Все дни мероприятия уже добавлены'))
    : 'Добавить день участия';

  return (
    <div className="participant-wrapper">
      <div className="participant-card">
        <div className="participant-card__main">
          <StudentNameInput
            value={participant.fio}
            studentsList={studentsList}
            readOnly={identityLocked}
            onChange={(val) => onUpdateParticipant(index, { ...participant, fio: val, student_id: identityLocked ? participant.student_id : null })}
            onSelectStudent={(data) => {
              onUpdateParticipant(index, {
                ...participant,
                fio: data.fullName,
                phone: data.phone ? normalizePhoneDigits(data.phone) : '',
                student_id: data.studentId,
              });
            }}
          />
          <select
            className="participant-card__role"
            value={participant.role || 'Участник'}
            disabled={readOnly}
            onChange={(e) => onUpdateParticipant(index, { ...participant, role: e.target.value })}
          >
            {roleOptions.map((role) => (
              <option key={role} value={role}>{role}</option>
            ))}
          </select>
          <input
            type="text"
            className="participant-card__phone"
            inputMode="tel"
            autoComplete="tel"
            value={participant.phone ? formatPhone(participant.phone) : ''}
            onChange={(e) => {
              const digits = normalizePhoneDigits(e.target.value);
              onUpdateParticipant(index, {
                ...participant,
                phone: digits,
                student_id: identityLocked ? participant.student_id : null,
              });
            }}
            placeholder="+7 (___) ___-__-__"
            maxLength={18}
            readOnly={identityLocked}
          />
        </div>
        {showTimeSlots && (
          <div className="participant-card__time">
            <div className="participant-card__duration">
              <svg className="participant-card__clock-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="7" stroke="#397AB2" strokeWidth="1.5" />
                <path d="M8 4V8L11 10" stroke="#397AB2" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <span className="participant-card__duration-text">{durationText}</span>
            </div>
            <div className="participant-card__slots">
              {timeSlots.map((slot, slotIdx) => {
                const usedByOtherSlots = new Set(
                  timeSlots
                    .filter((_, indexInList) => indexInList !== slotIdx)
                    .map((timeSlot) => timeSlot.date)
                    .filter(Boolean),
                );
                const slotDateOptions = availableDateOptions
                  ? availableDateOptions.filter((date) => date === slot.date || !usedByOtherSlots.has(date))
                  : null;

                return (
                  <TimeSlotInput
                    key={slotIdx}
                    slot={slot}
                    dateOptions={slotDateOptions}
                    onChange={(field, value) => onUpdateTimeSlot(index, slotIdx, field, value)}
                    onRemove={() => onRemoveTimeSlot(index, slotIdx)}
                    readOnly={readOnly}
                  />
                );
              })}
              {!readOnly ? (
                <button
                  type="button"
                  className="participant-card__add-time"
                  onClick={() => onAddTimeSlot(index)}
                  disabled={!canAddTimeSlot}
                  title={addTimeSlotTitle}
                >
                  +
                </button>
              ) : null}
            </div>
          </div>
        )}
        {canCreateSpravka ? (
          <div className="participant-card__spravka-wrap">
            <button
              type="button"
              className="spravka-btn"
              disabled={isSpravkaLoading}
              onClick={() => onCreateSpravka(participant)}
            >
              {isSpravkaLoading ? 'Формирование...' : 'Создать справку'}
            </button>
          </div>
        ) : null}
      </div>
      {!readOnly ? (
        <button type="button" className="participant-card__remove-outside" onClick={() => onRemove(index)}>−</button>
      ) : null}
    </div>
  );
}
