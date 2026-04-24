import { useEffect, useState } from 'react';
import { Header } from './components/layout/Header.jsx';
import { HomePage } from './pages/HomePage.jsx';
import { ParticipantRegistrationPage } from './pages/ParticipantRegistrationPage.jsx';
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

  const isRegistrationPage = route === 'create';

  return (
    <div className="app-shell">
      <Header />
      <main className={`app-content ${isRegistrationPage ? 'app-content--wide' : ''}`}>
        {route === 'create' ? <ParticipantRegistrationPage /> : <HomePage />}
      </main>
    </div>
  );
}
