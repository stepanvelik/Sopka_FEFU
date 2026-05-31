import logo from '../../assets/rus.svg';
import './Header.css';

const navGroups = [
  {
    label: 'Главная',
    href: '#home',
    routes: ['home', ''],
  },
  {
    label: 'Участники',
    href: '#database',
    routes: ['database', 'create', 'import', 'edit', 'edit-participant'],
    items: [
      { label: 'Список', href: '#database', route: 'database' },
      { label: 'Добавить', href: '#create', route: 'create' },
      { label: 'Импорт', href: '#import', route: 'import' },
    ],
  },
  {
    label: 'Мероприятия',
    href: '#events-list',
    routes: ['events-list', 'create-event', 'edit-event', 'event-details'],
    items: [
      { label: 'Список', href: '#events-list', route: 'events-list' },
      { label: 'Создать', href: '#create-event', route: 'create-event' },
    ],
  },
  {
    label: 'Отчёты',
    href: '#participants-summary',
    routes: ['participants-summary', 'student-events', 'event-statistics'],
    items: [
      { label: 'Сводная', href: '#participants-summary', route: 'participants-summary' },
      { label: 'По студенту', href: '#student-events', route: 'student-events' },
      { label: 'По мероприятию', href: '#event-statistics', route: 'event-statistics' },
    ],
  },
  {
    label: 'Документы',
    href: '#documents-spravki',
    routes: ['documents-spravki'],
    items: [
      { label: 'Справки по мероприятию', href: '#documents-spravki', route: 'documents-spravki' },
    ],
  },
];

function UniversityMark() {
  return (
    <div className="university-mark">
      <img className="university-mark__logo" src={logo} alt="Логотип ДВФУ" />
    </div>
  );
}

function isGroupActive(group, route) {
  return group.routes.some((item) => route === item || route.startsWith(`${item}/`));
}

export function Header({ route = 'home' }) {
  return (
    <header className="header">
      <div className="header__left">
        <UniversityMark />
        <span className="header__title">Учёт занятости студентов в отряде ДВФУ</span>
      </div>
      <nav className="header__nav" aria-label="Основная навигация">
        {navGroups.map((group) => {
          const active = isGroupActive(group, route);
          return (
            <div key={group.label} className={`header__nav-group${active ? ' header__nav-group--active' : ''}`}>
              <a className="header__nav-link" href={group.href}>
                {group.label}
              </a>
              {group.items?.length ? (
                <div className="header__submenu">
                  {group.items.map((item) => (
                    <a
                      key={item.route}
                      className={`header__submenu-link${route === item.route ? ' header__submenu-link--active' : ''}`}
                      href={item.href}
                    >
                      {item.label}
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>
      <a className="header__logout" href="#logout">
        Выход
      </a>
    </header>
  );
}
