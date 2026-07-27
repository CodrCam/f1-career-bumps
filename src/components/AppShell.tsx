import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  BarChart3,
  Gauge,
  GitCompareArrows,
  Menu,
  Route,
  Trophy,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import {
  Link,
  NavLink,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import {
  AVAILABLE_SEASONS,
  CURRENT_SEASON,
  getSeasonFromParam,
} from '../utils/seasons.js';
import GlobalSearch from './GlobalSearch';
import './AppShell.css';

interface AppShellProps {
  children: ReactNode;
}

interface NavigationItem {
  label: string;
  path: string;
  icon: typeof Trophy;
}

const AppShell = ({ children }: AppShellProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const headerRef = useRef<HTMLElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const seasonMatch = location.pathname.match(/^\/(\d{4})(?:\/|$)/);
  const activeSeason = getSeasonFromParam(
    seasonMatch?.[1] ?? CURRENT_SEASON,
  );
  const isSeasonDesk = /^\/(?:\d{4})?\/?$/.test(location.pathname);
  const navigation: NavigationItem[] = [
    {
      label: 'Races',
      path: `/${activeSeason}/races`,
      icon: Route,
    },
    {
      label: 'Drivers',
      path: `/${activeSeason}/drivers`,
      icon: Trophy,
    },
    {
      label: 'Teams',
      path: `/${activeSeason}/standings/constructors`,
      icon: Users,
    },
    {
      label: 'Results',
      path: `/${activeSeason}/results`,
      icon: BarChart3,
    },
    {
      label: 'Compare',
      path: `/${activeSeason}/compare`,
      icon: GitCompareArrows,
    },
    {
      label: 'Pace',
      path: `/${activeSeason}/pace`,
      icon: Gauge,
    },
    {
      label: 'Pit lane',
      path: `/${activeSeason}/pit-lane`,
      icon: Wrench,
    },
  ];

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.dataset.navOpen = String(menuOpen);

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    const handleOutside = (event: MouseEvent) => {
      if (
        menuOpen
        && headerRef.current
        && !headerRef.current.contains(event.target as Node)
      ) {
        setMenuOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.addEventListener('mousedown', handleOutside);
    return () => {
      delete document.body.dataset.navOpen;
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('mousedown', handleOutside);
    };
  }, [menuOpen]);

  const handleSeasonChange = (value: string) => {
    const year = getSeasonFromParam(value);
    if (!seasonMatch) {
      navigate(`/${year}`);
      return;
    }
    navigate(location.pathname.replace(/^\/\d{4}(?=\/|$)/, `/${year}`));
  };

  return (
    <div className="slip-app">
      <a className="slip-skip-link" href="#main-content">Skip to main content</a>

      <header className="slip-header" ref={headerRef}>
        <div className="slip-header__inner">
          <Link className="slip-brand" to={`/${activeSeason}`} aria-label="Slipstream season desk">
            <span className="slip-brand__mark" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span className="slip-brand__copy">
              <strong>Slipstream</strong>
              <small>Independent F1 analysis</small>
            </span>
          </Link>

          <nav
            className={`slip-nav ${menuOpen ? 'is-open' : ''}`}
            id="primary-navigation"
            aria-label="Primary navigation"
          >
            <NavLink
              className={({ isActive }) => (
                `slip-nav__link slip-nav__desk ${isActive && isSeasonDesk ? 'is-active' : ''}`
              )}
              to={`/${activeSeason}`}
              end
            >
              <span>Season desk</span>
              <small>Live overview</small>
            </NavLink>

            <div className="slip-nav__routes">
              {navigation.map(({ label, path, icon: Icon }) => (
                <NavLink
                  className={({ isActive }) => `slip-nav__link ${isActive ? 'is-active' : ''}`}
                  key={label}
                  to={path}
                >
                  <Icon aria-hidden="true" size={15} />
                  <span>{label}</span>
                </NavLink>
              ))}
            </div>

            <Link className="slip-nav__about" to="/methodology">Methodology</Link>
          </nav>

          <div className="slip-header__tools">
            <GlobalSearch activeSeason={activeSeason} />

            <label className="slip-season-select">
              <span>Season</span>
              <select
                aria-label="Season"
                onChange={(event) => handleSeasonChange(event.target.value)}
                value={activeSeason}
              >
                {AVAILABLE_SEASONS.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </label>

            <button
              className="slip-menu-button"
              type="button"
              aria-controls="primary-navigation"
              aria-expanded={menuOpen}
              aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
            </button>
          </div>
        </div>
      </header>

      <div className="slip-app__content" id="main-content">
        {children}
      </div>

      <footer className="slip-footer">
        <div>
          <span>Slipstream</span>
          <p>Independent race, championship, pace, and strategy analysis.</p>
        </div>
        <nav aria-label="Footer navigation">
          <Link to={`/${activeSeason}`}>Season desk</Link>
          <Link to={`/${activeSeason}/races`}>Race dossiers</Link>
          <Link to="/methodology">Methodology</Link>
        </nav>
      </footer>
    </div>
  );
};

export default AppShell;
