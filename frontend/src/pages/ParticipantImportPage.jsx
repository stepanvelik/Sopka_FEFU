import './ParticipantImportPage.css';
import { useMemo, useState } from 'react';
import { importStudentsExcel } from '../lib/api.js';

export function ParticipantImportPage() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [mode, setMode] = useState('update');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const summary = useMemo(() => {
    if (!result) return null;
    return [
      `Всего строк: ${result.total}`,
      `Создано: ${result.created}`,
      `Обновлено: ${result.updated}`,
      `Пропущено: ${result.skipped}`,
      `Ошибок по строкам: ${result.failed}`,
      `Банк: создано ${result.bank_created}, обновлено ${result.bank_updated}`,
    ];
  }, [result]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setResult(null);
    if (!selectedFile) {
      setError('Выберите Excel-файл перед загрузкой.');
      return;
    }

    try {
      setIsLoading(true);
      const payload = await importStudentsExcel(selectedFile, { mode });
      setResult(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось выполнить импорт.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="participant-import-page">
      <h1 className="participant-import-page__title">Загрузка участников из файла</h1>

      <form className="participant-import-page__form" onSubmit={handleSubmit}>
        <div className="participant-import-page__upload-panel">
          <label className="participant-import-page__file-field" htmlFor="participants-file">
            <span className="participant-import-page__file-label">Файл из Excel</span>
            <span className="participant-import-page__file-control">
              <input
                className="participant-import-page__file-input"
                id="participants-file"
                name="participants-file"
                type="file"
                accept=".xlsx,.xls"
                onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
              />
            </span>
          </label>

          <label className="participant-import-page__file-field" htmlFor="import-mode">
            <span className="participant-import-page__file-label">Режим обработки дублей</span>
            <select
              className="participant-import-page__select"
              id="import-mode"
              value={mode}
              onChange={(event) => setMode(event.target.value)}
            >
              <option value="update">Обновлять существующих</option>
              <option value="skip">Пропускать существующих</option>
            </select>
          </label>

          <div className="participant-import-page__actions">
            <button
              className="participant-import-page__button participant-import-page__button--primary"
              type="submit"
              disabled={isLoading}
            >
              {isLoading ? 'Загрузка...' : 'Загрузить'}
            </button>
            <a className="participant-import-page__button participant-import-page__button--link" href="#home">
              Вернуться назад
            </a>
          </div>
        </div>
      </form>

      <section className="participant-import-page__log-panel" aria-label="Логи импорта">
        {error ? <p className="participant-import-page__log-error">{error}</p> : null}
        {summary ? (
          <ul className="participant-import-page__log-list">
            {summary.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : null}
        {result?.warnings?.length ? (
          <p className="participant-import-page__log-warn">Предупреждения: {result.warnings.join('; ')}</p>
        ) : null}
        {result?.errors?.length ? (
          <div className="participant-import-page__log-errors">
            <strong>Детали ошибок:</strong>
            <ul>
              {result.errors.slice(0, 15).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </div>
  );
}
