// src/components/Navbar.jsx
import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import "./Navbar.css";

const Navbar = () => {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth >= 768) {
        setIsMobileMenuOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const navStyle = (path) =>
    location.pathname === path ? "nav-link active" : "nav-link";

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <div className="nav-title">
          <Link to="/" className="nav-brand">
            F1 Career Bumps
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

        <ul className={`nav-links ${isMobile ? (isMobileMenuOpen ? 'mobile-open' : 'mobile-closed') : ''}`}>
          <li>
            <Link 
              to="/2025-constructors" 
              className={navStyle("/2025-constructors")}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Constructors 2025
            </Link>
          </li>
          <li>
            <Link 
              to="/2025-drivers" 
              className={navStyle("/2025-drivers")}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Drivers 2025
            </Link>
          </li>
          <li>
            <Link 
              to="/driver-results" 
              className={navStyle("/driver-results")}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Results Table
            </Link>
          </li>
          <li>
            <Link 
              to="/driver-stats" 
              className={navStyle("/driver-stats")}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Driver Stats
            </Link>
          </li>
          <li>
            <Link 
              to="/head-to-head" 
              className={navStyle("/head-to-head")}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Head to Head
            </Link>
          </li>
        </ul>
      </div>
    </header>
  );
};

export default Navbar;