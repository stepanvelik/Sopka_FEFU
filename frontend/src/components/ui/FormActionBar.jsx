import { useMemo, useState } from 'react';
import './FormActionBar.css';

export function FormActionBar({
  canSubmit,
  isSubmitting,
  submitLabel,
  submittingLabel = 'Сохранение...',
  cancelHref = '#',
  cancelLabel = 'Отмена',
  validationMessages = [],
  successMessage = '',
  readyMessage = 'Все обязательные данные заполнены.',
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasErrors = validationMessages.length > 0;
  const state = successMessage ? 'success' : canSubmit ? 'ready' : 'error';

  const title = useMemo(() => {
    if (successMessage) return 'Сохранено';
    if (hasErrors) return `Есть ошибки: ${validationMessages.length}`;
    return 'Можно сохранить';
  }, [hasErrors, successMessage, validationMessages.length]);

  return (
    <div className={`form-action-bar form-action-bar--${state}`} aria-live="polite">
      <div className="form-action-bar__status">
        <span className="form-action-bar__title">{title}</span>
        <span className="form-action-bar__message">
          {successMessage || (hasErrors ? 'Проверьте обязательные поля формы.' : readyMessage)}
        </span>
        {hasErrors ? (
          <button
            type="button"
            className="form-action-bar__check"
            onClick={() => setIsExpanded((current) => !current)}
          >
            {isExpanded ? 'Скрыть ошибки' : 'Проверить'}
          </button>
        ) : (
          <button type="button" className="form-action-bar__check" onClick={() => setIsExpanded(false)}>
            Проверено
          </button>
        )}
      </div>

      <div className="form-action-bar__buttons">
        <a className="form-action-bar__cancel" href={cancelHref}>
          {cancelLabel}
        </a>
        <button className="form-action-bar__submit" type="submit" disabled={!canSubmit || isSubmitting}>
          {isSubmitting ? submittingLabel : submitLabel}
        </button>
      </div>

      {hasErrors && isExpanded ? (
        <ul className="form-action-bar__errors">
          {validationMessages.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
