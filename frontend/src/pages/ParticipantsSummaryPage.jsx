import { useEffect, useMemo, useState } from 'react';
import { FilterBar } from '../components/ui/FilterBar.jsx';
import { PageHeader } from '../components/ui/PageHeader.jsx';
import { getParticipantsSummaryReport, listEventTypes } from '../lib/api.js';
import './ParticipantsSummaryPage.css';

const eventLevelOptions = [
  'Всероссийский',
  'Региональный',
  'Городской',
  'Университетский',
  'Институтский',
];

const emptyReport = {
  participant_count: 0,
  event_count: 0,
  events: [],
  rows: [],
};

function formatPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) {
    return 'Не указан';
  }
  if (digits.length === 11 && digits.startsWith('7')) {
    return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9, 11)}`;
  }
  return digits;
}

function formatHours(value) {
  const number = Number(value || 0);
  return number > 0 ? number.toLocaleString('ru-RU', { maximumFractionDigits: 2 }) : '';
}

function formatDate(value) {
  if (!value) {
    return '';
  }
  return new Date(`${String(value).slice(0, 10)}T12:00:00`).toLocaleDateString('ru-RU');
}

function getEventDateLabel(event) {
  const start = formatDate(event.start_date);
  const end = formatDate(event.end_date);
  return end && end !== start ? `${start} - ${end}` : start;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function ParticipantsSummaryPage() {
  const [filters, setFilters] = useState({
    search: '',
    dateFrom: '',
    dateTo: '',
    eventLevel: '',
    eventTypeId: '',
  });
  const [appliedFilters, setAppliedFilters] = useState(filters);
  const [eventTypes, setEventTypes] = useState([]);
  const [report, setReport] = useState(emptyReport);
  const [status, setStatus] = useState({ type: 'loading', message: 'Загрузка сводной таблицы...' });

  useEffect(() => {
    let isMounted = true;

    listEventTypes({ limit: 200, isActive: true })
      .then((rows) => {
        if (isMounted) {
          setEventTypes(rows || []);
        }
      })
      .catch(() => {
        if (isMounted) {
          setEventTypes([]);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    setStatus({ type: 'loading', message: 'Загрузка сводной таблицы...' });

    getParticipantsSummaryReport(appliedFilters)
      .then((data) => {
        if (!isMounted) {
          return;
        }
        setReport(data || emptyReport);
        setStatus({ type: 'idle', message: '' });
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }
        setReport(emptyReport);
        setStatus({
          type: 'error',
          message: error instanceof Error ? error.message : 'Не удалось загрузить сводную таблицу.',
        });
      });

    return () => {
      isMounted = false;
    };
  }, [appliedFilters]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setAppliedFilters(filters);
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [filters]);

  const tableMinWidth = useMemo(() => {
    return Math.max(760, 380 + report.events.length * 184);
  }, [report.events.length]);

  function updateFilter(name, value) {
    setFilters((current) => ({ ...current, [name]: value }));
  }

  function resetFilters() {
    const nextFilters = {
      search: '',
      dateFrom: '',
      dateTo: '',
      eventLevel: '',
      eventTypeId: '',
    };
    setFilters(nextFilters);
    setAppliedFilters(nextFilters);
  }

  function exportToExcel() {
    const headerCells = [
      'ФИО',
      'Номер телефона',
      'Общее число рабочих часов',
      ...report.events.map((event) => `${event.event_name} ${getEventDateLabel(event)}`),
    ];
    const rows = report.rows.map((row) => [
      row.full_name,
      formatPhone(row.phone),
      formatHours(row.total_hours),
      ...row.events.map((cell) => formatHours(cell.hours)),
    ]);
    const html = `
      <html>
        <head><meta charset="UTF-8" /></head>
        <body>
          <table>
            <thead><tr>${headerCells.map((cell) => `<th>${escapeHtml(cell)}</th>`).join('')}</tr></thead>
            <tbody>
              ${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;
    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Сводная_таблица_по_участникам.xls';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="summary-page">
      <PageHeader
        title="Сводная таблица по участникам"
        actions={(
          <button
            type="button"
            className="summary-page__export"
            onClick={exportToExcel}
            disabled={report.events.length === 0}
          >
            Экспорт в Excel
          </button>
        )}
      />

      <FilterBar
        searchValue={filters.search}
        searchPlaceholder="Поиск по названию мероприятия"
        onSearchChange={(value) => updateFilter('search', value)}
        levelValue={filters.eventLevel}
        levelOptions={eventLevelOptions}
        onLevelChange={(value) => updateFilter('eventLevel', value)}
        typeValue={filters.eventTypeId}
        typeOptions={eventTypes.map((eventType) => ({
          value: String(eventType.event_type_id),
          label: eventType.event_type_name,
        }))}
        onTypeChange={(value) => updateFilter('eventTypeId', value)}
        dateFrom={filters.dateFrom}
        dateTo={filters.dateTo}
        onDateFromChange={(value) => updateFilter('dateFrom', value)}
        onDateToChange={(value) => updateFilter('dateTo', value)}
        onReset={resetFilters}
      />

      <div className="summary-page__counts">
        <span>Участников найдено: {report.participant_count}</span>
        <span>Мероприятий найдено: {report.event_count}</span>
      </div>

      {status.message ? (
        <p className={`summary-page__status summary-page__status--${status.type}`}>{status.message}</p>
      ) : null}

      {!status.message && report.events.length === 0 ? (
        <p className="summary-page__empty">По выбранным условиям мероприятия не найдены.</p>
      ) : null}

      {!status.message && report.events.length > 0 ? (
        <div className="summary-page__table-frame">
          <table className="summary-page__table" style={{ minWidth: `${tableMinWidth}px` }}>
            <thead>
              <tr>
                <th>ФИО</th>
                <th>Номер телефона</th>
                <th>Общее число рабочих часов</th>
                {report.events.map((event) => (
                  <th key={event.event_id}>
                    <a className="summary-page__event-name" href={`#event-details?id=${event.event_id}`}>
                      {event.event_name}
                    </a>
                    <span className="summary-page__event-meta">
                      {event.event_type_name || event.event_level}
                    </span>
                    <span className="summary-page__event-date">{getEventDateLabel(event)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.rows.length === 0 ? (
                <tr>
                  <td className="summary-page__table-empty" colSpan={3 + report.events.length}>
                    Участники по выбранным мероприятиям не найдены.
                  </td>
                </tr>
              ) : (
                report.rows.map((row) => (
                  <tr key={row.student_id}>
                    <td>
                      <a className="summary-page__student-link" href={`#edit-participant?id=${row.student_id}`}>
                        {row.full_name}
                      </a>
                    </td>
                    <td>{formatPhone(row.phone)}</td>
                    <td className="summary-page__hours-cell">{formatHours(row.total_hours)}</td>
                    {row.events.map((cell) => (
                      <td
                        key={`${row.student_id}-${cell.event_id}`}
                        className={Number(cell.hours || 0) > 0 ? 'summary-page__hours-cell summary-page__hours-cell--filled' : 'summary-page__hours-cell'}
                      >
                        {formatHours(cell.hours)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
