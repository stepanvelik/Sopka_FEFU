import './FilterBar.css';

function normalizeOptions(options) {
  return options.map((option) => {
    if (typeof option === 'string') {
      return { value: option, label: option };
    }
    return option;
  });
}

export function FilterBar({
  searchValue,
  searchPlaceholder = 'Поиск по названию...',
  onSearchChange,
  levelValue,
  levelOptions = [],
  onLevelChange,
  typeValue,
  typeOptions = [],
  onTypeChange,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  onReset,
}) {
  const normalizedLevelOptions = normalizeOptions(levelOptions);
  const normalizedTypeOptions = normalizeOptions(typeOptions);

  return (
    <div className="filter-bar">
      <input
        className="filter-bar__search"
        type="text"
        placeholder={searchPlaceholder}
        value={searchValue}
        onChange={(event) => onSearchChange(event.target.value)}
      />

      <select
        className="filter-bar__select"
        value={levelValue}
        onChange={(event) => onLevelChange(event.target.value)}
        aria-label="Уровень мероприятия"
      >
        <option value="">Все уровни</option>
        {normalizedLevelOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <select
        className="filter-bar__select"
        value={typeValue}
        onChange={(event) => onTypeChange(event.target.value)}
        aria-label="Тип мероприятия"
      >
        <option value="">Все типы</option>
        {normalizedTypeOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <span className="filter-bar__period-label">Период:</span>
      <input
        className="filter-bar__date"
        type="date"
        aria-label="Дата с"
        value={dateFrom}
        onChange={(event) => onDateFromChange(event.target.value)}
      />
      <span className="filter-bar__period-dash">-</span>
      <input
        className="filter-bar__date"
        type="date"
        aria-label="Дата по"
        value={dateTo}
        onChange={(event) => onDateToChange(event.target.value)}
      />

      <button className="filter-bar__reset" type="button" onClick={onReset}>
        Сбросить
      </button>
    </div>
  );
}
