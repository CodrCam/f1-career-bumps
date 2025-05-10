// src/components/Navbar.jsx
import React from "react";
import { Link, useLocation } from "react-router-dom";
import "./Navbar.css";

const Navbar = () => {
  const location = useLocation();

  const navStyle = (path) =>
    location.pathname === path ? "nav-link active" : "nav-link";

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <div className="nav-title">
          <Link to="/" className="nav-brand">
            F1 Career Bumps
          </Link>
        </div>
        <ul className="nav-links">
          <li>
            <Link to="/2025-constructors" className={navStyle("/2025-constructors")}>
              Constructors 2025
            </Link>
          </li>
          <li>
            <Link to="/2025-drivers" className={navStyle("/2025-drivers")}>
              Drivers 2025
            </Link>
          </li>
          <li>
            <Link to="/driver-results" className={navStyle("/driver-results")}>
              Results Table
            </Link>
          </li>
          <li>
            <Link to="/driver-stats" className={navStyle("/driver-stats")}>
              Driver Stats
            </Link>
          </li>
        </ul>
      </div>
    </header>
  );
};

export default Navbar;