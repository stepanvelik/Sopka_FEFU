import './ParticipantImportPage.css';

export function ParticipantImportPage() {
  function handleSubmit(event) {
    event.preventDefault();
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
              />
            </span>
          </label>

          <div className="participant-import-page__actions">
            <button className="participant-import-page__button participant-import-page__button--primary" type="submit">
              Загрузить
            </button>
            <button className="participant-import-page__button" type="button">
              Проверить документ
            </button>
            <a className="participant-import-page__button participant-import-page__button--link" href="#">
              Вернуться назад
            </a>
          </div>
        </div>
      </form>

      <section className="participant-import-page__log-panel" aria-label="Логи импорта" />
    </div>
  );
}
