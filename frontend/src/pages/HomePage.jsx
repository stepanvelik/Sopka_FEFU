import { ActionPanel } from '../components/features/ActionPanel.jsx';

const actions = [
  { id: 'create', label: 'Добавить участника вручную', href: '#create' },
  { id: 'import', label: 'Загрузить участников из файла', href: '#import' },
  { id: 'database', label: 'Просмотреть список участников', href: '#database' },
];

export function HomePage() {
  return <ActionPanel title="Работа с участниками СОПКи" actions={actions} />;
}
