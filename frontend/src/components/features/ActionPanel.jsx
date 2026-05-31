import { useId } from 'react';
import './ActionPanel.css';

export function ActionPanel({ title, actions }) {
  const titleId = useId();

  return (
    <section className="action-panel" aria-labelledby={titleId}>
      <h1 className="action-panel__title" id={titleId}>
        {title}
      </h1>
      <ul className="action-panel__list">
        {actions.map((action) => (
          <li key={action.id} className="action-panel__item">
            <a className="action-panel__link" href={action.href}>
              {action.label}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
