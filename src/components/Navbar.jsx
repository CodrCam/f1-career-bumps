// src/components/Navbar.jsx
import React, { useState, useEffect, useRef } from "react";
import {
  BarChart3,
  ChartNoAxesCombined,
  Clock3,
  Fuel,
  Gauge,
  GitCompareArrows,
  Route,
  Trophy,
  Users,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  AVAILABLE_SEASONS,
  CURRENT_SEASON,
  getSeasonFromParam,
  getSeasonPath,
  getSeasonSectionFromPath,
  isSeasonSectionSupported,
} from "../utils/seasons.js";
import BrandLogo from "./BrandLogo.jsx";
import "./Navbar.css";

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const seasonMatch = location.pathname.match(/^\/(\d{4})(?:\/|$)/);
  const activeSeason = getSeasonFromParam(seasonMatch?.[1] ?? CURRENT_SEASON);
  const activeSection = getSeasonSectionFromPath(location.pathname);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleResize = () => {
      const isMobileViewport = window.innerWidth <= 768;
      setIsMobile(isMobileViewport);
      if (!isMobileViewport) {
        setIsMobileMenuOpen(false);
      }
    };

    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setActiveDropdown(null);
      }
    };

    window.addEventListener('resize', handleResize);
    document.addEventListener('mousedown', handleClickOutside);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const navStyle = (path) =>
    location.pathname === path ? "nav-link active" : "nav-link";

  const dropdownStyle = (paths) =>
    paths.includes(location.pathname) ? "dropdown-toggle active" : "dropdown-toggle";

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
    setActiveDropdown(null);
  };

  const toggleDropdown = (dropdownName) => {
    if (isMobile) {
      setActiveDropdown(activeDropdown === dropdownName ? null : dropdownName);
    } else {
      setActiveDropdown(dropdownName);
    }
  };

  const closeDropdown = () => {
    setActiveDropdown(null);
    setIsMobileMenuOpen(false);
  };

  const handleSeasonChange = (event) => {
    navigate(getSeasonPath(Number(event.target.value), activeSection));
    closeDropdown();
  };

  // Navigation structure
  const navItems = [
    {
      type: 'dropdown',
      label: 'Championship',
      key: 'championship',
      paths: [getSeasonPath(activeSeason, 'constructors'), getSeasonPath(activeSeason, 'drivers')],
      items: [
        { path: getSeasonPath(activeSeason, 'drivers'), label: 'Driver Championship', icon: Trophy },
        { path: getSeasonPath(activeSeason, 'constructors'), label: 'Constructor Championship', icon: Users }
      ]
    },
    {
      type: 'dropdown',
      label: 'Driver Analysis',
      key: 'drivers',
      paths: [
        getSeasonPath(activeSeason, 'driver-results'),
        getSeasonPath(activeSeason, 'driver-stats'),
        getSeasonPath(activeSeason, 'head-to-head'),
        getSeasonPath(activeSeason, 'sector-analysis')
      ],
      items: [
        { path: getSeasonPath(activeSeason, 'driver-results'), label: 'Race Results', icon: BarChart3 },
        { path: getSeasonPath(activeSeason, 'driver-stats'), label: 'Performance Stats', icon: ChartNoAxesCombined },
        { path: getSeasonPath(activeSeason, 'head-to-head'), label: 'Head to Head', icon: GitCompareArrows },
        { path: getSeasonPath(activeSeason, 'sector-analysis'), label: 'Sector Times', icon: Gauge }
      ]
    },
    {
      type: 'dropdown',
      label: 'Race Analysis',
      key: 'live',
      paths: [
        getSeasonPath(activeSeason, 'pit-stop-analysis'),
        ...(activeSeason === 2026 ? [getSeasonPath(activeSeason, 'race-story')] : [])
      ],
      items: [
        ...(isSeasonSectionSupported(activeSeason, 'race-story')
          ? [{ path: getSeasonPath(activeSeason, 'race-story'), label: 'Race Story', icon: Route, badge: 'New' }]
          : []),
        { path: getSeasonPath(activeSeason, 'pit-stop-analysis'), label: 'Pit Stop Analysis', icon: Fuel }
      ]
    }
  ];

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <div className="nav-title">
          <Link to="/" className="nav-brand" aria-label="Slipstream home">
            <BrandLogo className="nav-brand-logo" />
            <span className="brand-copy">
              <span className="brand-text">Slipstream</span>
              <span className="brand-subtext">F1 analytics</span>
            </span>
          </Link>
        </div>
        
        {isMobile && (
          <button 
            className="mobile-menu-toggle"
            onClick={toggleMobileMenu}
            aria-label="Toggle mobile menu"
          >
            <span className={`hamburger ${isMobileMenuOpen ? 'open' : ''}`}>
              <span></span>
              <span></span>
              <span></span>
            </span>
          </button>
        )}

        <nav className={`nav-links ${isMobile ? (isMobileMenuOpen ? 'mobile-open' : 'mobile-closed') : ''}`} ref={dropdownRef}>
          <div className="season-switcher" aria-label="Season selector">
            <Clock3 aria-hidden="true" size={16} />
            <label className="season-select-label" htmlFor="season-select">
              Season
            </label>
            <select
              id="season-select"
              className="season-select"
              value={activeSeason}
              onChange={handleSeasonChange}
            >
              {AVAILABLE_SEASONS.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          {navItems.map((item) => (
            <div key={item.key} className="nav-item">
              {item.type === 'dropdown' ? (
                <div className="dropdown">
                  <button
                    type="button"
                    className={dropdownStyle(item.paths)}
                    onClick={() => toggleDropdown(item.key)}
                    onMouseEnter={() => !isMobile && setActiveDropdown(item.key)}
                    onMouseLeave={() => !isMobile && setActiveDropdown(null)}
                    aria-expanded={activeDropdown === item.key}
                  >
                    {item.label}
                    <span className={`dropdown-arrow ${activeDropdown === item.key ? 'open' : ''}`}>
                      ▼
                    </span>
                  </button>
                  
                  <div 
                    className={`dropdown-menu ${activeDropdown === item.key ? 'show' : ''}`}
                    onMouseEnter={() => !isMobile && setActiveDropdown(item.key)}
                    onMouseLeave={() => !isMobile && setActiveDropdown(null)}
                  >
                    {item.items.map((subItem) => {
                      const ItemIcon = subItem.icon;
                      return (
                        <Link
                          key={subItem.path}
                          to={subItem.path}
                          className={`dropdown-item ${location.pathname === subItem.path ? 'active' : ''}`}
                          onClick={closeDropdown}
                        >
                          <span className="item-icon"><ItemIcon aria-hidden="true" size={16} /></span>
                          <span className="item-label">{subItem.label}</span>
                          {subItem.badge && <span className="nav-item-badge">{subItem.badge}</span>}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <Link 
                  to={item.path} 
                  className={navStyle(item.path)}
                  onClick={closeDropdown}
                >
                  {item.label}
                </Link>
              )}
            </div>
          ))}

          {/* About link separate */}
          <div className="nav-item nav-item-about">
            <Link 
              to="/about" 
              className={navStyle("/about")}
              onClick={closeDropdown}
            >
              About
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
};

export default Navbar;
