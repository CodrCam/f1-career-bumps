// src/components/Navbar.jsx
import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import "./Navbar.css";

const Navbar = () => {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth >= 768) {
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

  // Navigation structure
  const navItems = [
    {
      type: 'dropdown',
      label: '2025 Season',
      key: 'season',
      paths: ['/2025-constructors', '/2025-drivers'],
      items: [
        { path: '/2025-constructors', label: 'Constructor Championship', icon: '🏆' },
        { path: '/2025-drivers', label: 'Driver Championship', icon: '🏁' }
      ]
    },
    {
      type: 'dropdown',
      label: 'Driver Analysis',
      key: 'drivers',
      paths: ['/driver-results', '/driver-stats', '/head-to-head'],
      items: [
        { path: '/driver-results', label: 'Race Results', icon: '📊' },
        { path: '/driver-stats', label: 'Performance Stats', icon: '📈' },
        { path: '/head-to-head', label: 'Head to Head', icon: '⚔️' }
      ]
    },
    {
      type: 'dropdown',
      label: 'Live Analysis',
      key: 'live',
      paths: ['/sector-analysis', '/pit-strategy', '/pit-stop-analysis'],
      items: [
        { path: '/sector-analysis', label: 'Sector Times', icon: '⏱️' },
        { path: '/pit-strategy', label: 'Pit Strategy', icon: '🔧' },
        { path: '/pit-stop-analysis', label: 'AI Pit Predictions', icon: '🤖' }
      ]
    }
  ];

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <div className="nav-title">
          <Link to="/" className="nav-brand">
            <span className="brand-icon">🏎️</span>
            <span className="brand-text">F1 Desktop</span>
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
          {navItems.map((item) => (
            <div key={item.key} className="nav-item">
              {item.type === 'dropdown' ? (
                <div className="dropdown">
                  <button
                    className={dropdownStyle(item.paths)}
                    onClick={() => toggleDropdown(item.key)}
                    onMouseEnter={() => !isMobile && setActiveDropdown(item.key)}
                    onMouseLeave={() => !isMobile && setActiveDropdown(null)}
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
                    {item.items.map((subItem) => (
                      <Link
                        key={subItem.path}
                        to={subItem.path}
                        className={`dropdown-item ${location.pathname === subItem.path ? 'active' : ''}`}
                        onClick={closeDropdown}
                      >
                        <span className="item-icon">{subItem.icon}</span>
                        <span className="item-label">{subItem.label}</span>
                      </Link>
                    ))}
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