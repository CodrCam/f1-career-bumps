import React from "react";
import { Link } from "react-router-dom";

const NotFound = () => (
  <main className="seo-fallback">
    <p className="seo-fallback__eyebrow">Slipstream F1 Analytics</p>
    <h1>Page not found</h1>
    <p>
      This route is not on the grid. Return home or jump into the current
      Formula 1 season.
    </p>
    <nav aria-label="Page not found destinations">
      <Link to="/">Home</Link>
      <Link to="/2026/drivers">2026 Drivers</Link>
      <Link to="/2026/constructors">2026 Constructors</Link>
      <Link to="/2026/race-story">2026 Race Story</Link>
    </nav>
  </main>
);

export default NotFound;
