import './PageHeader.css';

export function PageHeader({
  title,
  backLabel = 'На главную',
  backHref = '#',
  onBack,
  actions = null,
  variant = 'default',
}) {
  const hasActions = Boolean(actions);

  function handleBackClick(event) {
    if (!onBack) {
      return;
    }
    event.preventDefault();
    onBack();
  }

  return (
    <div className={`page-header page-header--${variant} ${hasActions ? 'page-header--with-actions' : ''}`}>
      <a className="page-header__back" href={backHref} onClick={handleBackClick}>
        {backLabel}
      </a>
      <div className="page-header__main">
        <h1 className="page-header__title">{title}</h1>
        {hasActions ? <div className="page-header__actions">{actions}</div> : null}
      </div>
    </div>
  );
}
