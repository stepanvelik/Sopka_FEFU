import { useEffect, useState } from 'react';
import { Header } from './components/layout/Header.jsx';
import { HomePage } from './pages/HomePage.jsx';
import { ParticipantEditPage } from './pages/ParticipantEditPage.jsx';
import { ParticipantImportPage } from './pages/ParticipantImportPage.jsx';
import { ParticipantRegistrationPage } from './pages/ParticipantRegistrationPage.jsx';
import { ParticipantsDatabasePage } from './pages/ParticipantsDatabasePage.jsx';
import { ParticipantsSummaryPage } from './pages/ParticipantsSummaryPage.jsx';
import { StudentEventsPage } from './pages/StudentEventsPage.jsx';
import { EventStatisticsPage } from './pages/EventStatisticsPage.jsx';
import { EventCreatePage } from './pages/EventCreatePage.jsx';
import { EventsListPage } from './pages/EventsListPage.jsx';
import { EventEditPage } from './pages/EventEditPage.jsx';
import { DocumentsSpravkiPage } from './pages/DocumentsSpravkiPage.jsx';
import { EventSpravkiPage } from './pages/EventSpravkiPage.jsx';
import EventDetailsPage from './pages/EventDetailsPage.jsx';
import './styles/app.css';

function parseHash() {
  const raw = (window.location.hash || '#').replace(/^#/, '');
  const pathPart = raw.split('?')[0] || 'home';
  const queryPart = raw.includes('?') ? raw.slice(raw.indexOf('?') + 1) : '';
  return { path: pathPart, params: new URLSearchParams(queryPart) };
}

function getRouteFromHash() {
  return parseHash().path;
}

/** ID участника для страницы редактирования (не путать с edit-event). */
function getParticipantEditId() {
  const { path, params } = parseHash();
  if (path === 'edit-event' || path.startsWith('edit-event')) {
    return null;
  }
  if (path === 'event-details' || path.startsWith('event-details')) {
    return null;
  }
  if (path.startsWith('edit-participant/')) {
    const id = path.slice('edit-participant/'.length).split('/')[0];
    return id || null;
  }
  if (path === 'edit-participant') {
    return params.get('id') || null;
  }
  if (path.startsWith('edit/')) {
    const id = path.slice('edit/'.length).split('/')[0];
    return id || null;
  }
  if (path === 'edit') {
    return params.get('id') || null;
  }
  return null;
}

/** ID мероприятия для страницы деталей */
function getEventDetailsId() {
  const { path, params } = parseHash();
  if (path === 'event-details') {
    return params.get('id') || null;
  }
  if (path.startsWith('event-details/')) {
    const id = path.slice('event-details/'.length).split('/')[0];
    return id || null;
  }
  return null;
}

export default function App() {
  const [route, setRoute] = useState(getRouteFromHash);

  useEffect(() => {
    function handleHashChange() {
      setRoute(getRouteFromHash());
    }

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const participantEditId = getParticipantEditId();
  const eventDetailsId = getEventDetailsId();
  const isEditParticipantPage = Boolean(participantEditId);
  const isEditEventPage = route === 'edit-event';
  const isEventDetailsPage = route === 'event-details' && Boolean(eventDetailsId);
  const isParticipantsSummaryPage = route === 'participants-summary';
  const isStudentEventsPage = route === 'student-events';
  const isEventStatisticsPage = route === 'event-statistics';
  const isDocumentsSpravkiPage = route === 'documents-spravki';
  const isEventSpravkiPage = route === 'event-spravki';

  const isWidePage =
    route === 'create' ||
    route === 'database' ||
    route === 'import' ||
    route === 'participants-summary' ||
    route === 'student-events' ||
    route === 'event-statistics' ||
    route === 'documents-spravki' ||
    route === 'event-spravki' ||
    route === 'create-event' ||
    route === 'events-list' ||
    isEditEventPage ||
    isEditParticipantPage ||
    isEventDetailsPage;

  const showHomePage =
    route !== 'create' &&
    route !== 'import' &&
    route !== 'database' &&
    route !== 'participants-summary' &&
    route !== 'student-events' &&
    route !== 'event-statistics' &&
    route !== 'documents-spravki' &&
    route !== 'event-spravki' &&
    route !== 'create-event' &&
    route !== 'events-list' &&
    route !== 'edit-event' &&
    route !== 'event-details' &&
    !isEditParticipantPage;

  return (
    <div className="app-shell">
      <Header route={route} />
      <main className={`app-content ${isWidePage ? 'app-content--wide' : ''}`}>
        {route === 'create' ? <ParticipantRegistrationPage /> : null}
        {route === 'import' ? <ParticipantImportPage /> : null}
        {route === 'database' ? <ParticipantsDatabasePage /> : null}
        {isParticipantsSummaryPage ? <ParticipantsSummaryPage /> : null}
        {isStudentEventsPage ? <StudentEventsPage /> : null}
        {isEventStatisticsPage ? <EventStatisticsPage /> : null}
        {isDocumentsSpravkiPage ? <DocumentsSpravkiPage /> : null}
        {isEventSpravkiPage ? <EventSpravkiPage /> : null}
        {isEditParticipantPage ? <ParticipantEditPage studentId={participantEditId} /> : null}

        {route === 'events-list' ? <EventsListPage /> : null}
        {route === 'create-event' ? <EventCreatePage /> : null}
        {isEditEventPage ? <EventEditPage /> : null}
        {isEventDetailsPage ? <EventDetailsPage eventId={eventDetailsId} /> : null}

        {showHomePage ? <HomePage /> : null}
      </main>
    </div>
  );
}
