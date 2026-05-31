/** Даты мероприятия (включительно). Если дата окончания пуста — один день. */
export function enumerateEventDates(startStr, endStr) {
  if (!startStr) return [];
  const end = !endStr || endStr < startStr ? startStr : endStr;
  const out = [];
  const cur = new Date(`${startStr}T12:00:00`);
  const last = new Date(`${end}T12:00:00`);
  while (cur <= last) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

export function mergeScheduleWithDates(dates, previousRows) {
  const prevByDate = Object.fromEntries((previousRows || []).map((r) => [r.date, r]));
  return dates.map((date) => ({
    date,
    start: prevByDate[date]?.start ?? '',
    end: prevByDate[date]?.end ?? '',
  }));
}

export function sliceTimeForInput(value) {
  if (value == null || value === '') return '';
  if (typeof value === 'string' && /^\d{2}:\d{2}/.test(value)) return value.slice(0, 5);
  return '';
}

/** Ответ API → строки редактора */
export function apiScheduleToRows(api) {
  if (!Array.isArray(api) || api.length === 0) return [];
  return api.map((item) => {
    const rawDate = item.date;
    const dateStr = typeof rawDate === 'string' ? rawDate.slice(0, 10) : rawDate;
    return {
      date: dateStr,
      start: sliceTimeForInput(item.start_time),
      end: sliceTimeForInput(item.end_time),
    };
  });
}

/** Строки редактора → тело запроса API */
export function scheduleRowsToApi(rows) {
  return (rows || [])
    .filter((r) => r.date && r.start && r.end)
    .map((r) => ({
      date: r.date,
      start_time: r.start.length === 5 ? `${r.start}:00` : r.start,
      end_time: r.end.length === 5 ? `${r.end}:00` : r.end,
    }));
}

export function sumScheduleHours(rows) {
  let total = 0;
  for (const r of rows || []) {
    if (!r.start || !r.end) continue;
    const [sh, sm] = r.start.split(':').map(Number);
    const [eh, em] = r.end.split(':').map(Number);
    const m = (eh * 60 + em) - (sh * 60 + sm);
    if (m > 0) total += m / 60;
  }
  return Math.round(total * 2) / 2;
}

export function formatHoursMinutes(value, emptyValue = '') {
  const number = Number(value || 0);
  if (!Number.isFinite(number) || number <= 0) return emptyValue;

  const totalMinutes = Math.round(number * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const parts = [];

  if (hours > 0) {
    parts.push(`${hours} \u0447.`);
  }
  if (minutes > 0) {
    parts.push(`${minutes} \u043c\u0438\u043d.`);
  }

  return parts.join(' ') || emptyValue;
}

export function formatRuDateShort(isoDate) {
  if (!isoDate) return '';
  const d = new Date(`${String(isoDate).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Краткая строка для карточки списка */
export function formatEventScheduleSummary(event) {
  const rows = event?.event_daily_schedule;
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return rows
    .map((r) => {
      const ds = formatRuDateShort(r.date);
      const a = sliceTimeForInput(r.start_time);
      const b = sliceTimeForInput(r.end_time);
      if (!a || !b) return null;
      return `${ds}: ${a}–${b}`;
    })
    .filter(Boolean)
    .join(' · ');
}

export function formatTimeDisplay(value) {
  if (value == null || value === '') return '—';
  if (typeof value === 'string' && /^\d{2}:\d{2}/.test(value)) return value.slice(0, 5);
  try {
    return new Date(value).toTimeString().slice(0, 5);
  } catch {
    return String(value);
  }
}
