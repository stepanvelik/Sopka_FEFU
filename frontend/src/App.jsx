import { useEffect, useState } from 'react';
import { Header } from './components/layout/Header.jsx';
import { HomePage } from './pages/HomePage.jsx';
import { ParticipantImportPage } from './pages/ParticipantImportPage.jsx';
import { ParticipantRegistrationPage } from './pages/ParticipantRegistrationPage.jsx';
import { ParticipantsDatabasePage } from './pages/ParticipantsDatabasePage.jsx';
import './styles/app.css';

function getRouteFromHash() {
  const route = window.location.hash.replace('#', '');
  return route || 'home';
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

  const isWidePage = route === 'create' || route === 'database' || route === 'import';

  return (
    <div className="app-shell">
      <Header />
      <main className={`app-content ${isWidePage ? 'app-content--wide' : ''}`}>
        {route === 'create' ? <ParticipantRegistrationPage /> : null}
        {route === 'import' ? <ParticipantImportPage /> : null}
        {route === 'database' ? <ParticipantsDatabasePage /> : null}
        {route !== 'create' && route !== 'import' && route !== 'database' ? <HomePage /> : null}
      </main>
    </div>
  );
}
