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
      <div className="header__left">
        <UniversityMark />
        <span className="header__title">Учёт занятости студентов в отряде ДВФУ</span>
      </div>
      <a className="header__logout" href="#logout">
        Выход
      </a>
    </header>
  );
}
