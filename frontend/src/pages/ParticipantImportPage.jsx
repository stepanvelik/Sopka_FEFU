import './ParticipantImportPage.css';
import { useMemo, useState, useRef, useCallback } from 'react';
import { importStudentsExcel } from '../lib/api.js';

export function ParticipantImportPage() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [mode, setMode] = useState('update');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);
  const dragCounter = useRef(0);

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

  const acceptFile = useCallback((file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls'].includes(ext)) {
      setError('Поддерживаются только файлы .xlsx и .xls');
      return;
    }
    setError('');
    setSelectedFile(file);
  }, []);

  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    dragCounter.current += 1;
    if (dragCounter.current === 1) setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    acceptFile(file);
  }, [acceptFile]);

  const handleFileChange = useCallback((e) => {
    acceptFile(e.target.files?.[0] ?? null);
  }, [acceptFile]);

  const handleZoneClick = () => {
    fileInputRef.current?.click();
  };

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

          {/* Drag & drop zone */}
          <div
            className={`pip-dropzone${isDragging ? ' pip-dropzone--active' : ''}${selectedFile ? ' pip-dropzone--has-file' : ''}`}
            onClick={handleZoneClick}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            role="button"
            tabIndex={0}
            aria-label="Загрузить Excel-файл"
            onKeyDown={(e) => e.key === 'Enter' && handleZoneClick()}
          >
            <input
              ref={fileInputRef}
              className="pip-dropzone__input"
              id="participants-file"
              name="participants-file"
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
            />

            <div className="pip-dropzone__icon-wrap">
              {selectedFile ? (
                <svg className="pip-dropzone__icon pip-dropzone__icon--file" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="8" y="4" width="24" height="32" rx="3" fill="#e8f5e9" stroke="#43a047" strokeWidth="2"/>
                  <rect x="32" y="4" width="8" height="8" rx="1" fill="#c8e6c9" stroke="#43a047" strokeWidth="2"/>
                  <path d="M32 4 L40 12" stroke="#43a047" strokeWidth="2"/>
                  <rect x="13" y="20" width="14" height="2.5" rx="1.2" fill="#43a047" opacity="0.5"/>
                  <rect x="13" y="26" width="10" height="2.5" rx="1.2" fill="#43a047" opacity="0.5"/>
                  <circle cx="36" cy="36" r="8" fill="#43a047"/>
                  <path d="M32 36 L35 39 L40 33" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : (
                <svg className="pip-dropzone__icon" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="8" y="14" width="32" height="26" rx="4" fill="#dbeafe" stroke="#93c5fd" strokeWidth="1.5" strokeDasharray="4 3"/>
                  <path d="M24 32 V20" stroke="#3b82f6" strokeWidth="2.2" strokeLinecap="round"/>
                  <path d="M19 25 L24 20 L29 25" stroke="#3b82f6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                  <rect x="16" y="8" width="16" height="10" rx="3" fill="#bfdbfe" stroke="#60a5fa" strokeWidth="1.5"/>
                  <path d="M20 13 H28" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              )}
            </div>

            <div className="pip-dropzone__text">
              {selectedFile ? (
                <>
                  <span className="pip-dropzone__filename">{selectedFile.name}</span>
                  <span className="pip-dropzone__hint">
                    {(selectedFile.size / 1024).toFixed(1)} КБ · нажмите, чтобы заменить
                  </span>
                </>
              ) : (
                <>
                  <span className="pip-dropzone__primary">
                    {isDragging ? 'Отпустите файл' : 'Перетащите файл сюда'}
                  </span>
                  <span className="pip-dropzone__hint">или нажмите для выбора · .xlsx, .xls</span>
                </>
              )}
            </div>
          </div>

          {/* Mode select */}
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
