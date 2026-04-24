import logo from '../../assets/rus.svg';
import './Header.css';

function UniversityMark() {
  return (
    <div className="university-mark">
      <img className="university-mark__logo" src={logo} alt="Логотип ДВФУ" />
    </div>
  );
}

export function Header() {
  return (
    <header className="header">
      <UniversityMark />
      <a className="header__logout" href="#logout">
        Выход
      </a>
    </header>
  );
}
