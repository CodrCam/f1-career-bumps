import React from "react";
import { Link } from "react-router-dom";
import { Rocket, BarChart3, Users2, Timer, Target, Activity, CalendarClock, BookOpenText } from "lucide-react";
import SeasonGrid from "../components/SeasonGrid.jsx";
import { AVAILABLE_SEASONS, CURRENT_SEASON, getSeasonPath } from "../utils/seasons.js";

const Home = () => {
  return (
    <div className="home-container">
      <div className="home-content">
        <div className="season-strip" aria-label="Available seasons">
          <CalendarClock size={18} />
          {AVAILABLE_SEASONS.map((year) => (
            <Link key={year} to={getSeasonPath(year, 'drivers')} className="season-pill">
              {year}
            </Link>
          ))}
        </div>

        <SeasonGrid />

        <div className="home-tools-heading">
          <span className="section-kicker">Explore the season</span>
          <h2>Race and championship analysis</h2>
        </div>

        <div className="card-grid">
          <Link to={getSeasonPath(CURRENT_SEASON, 'race-story')} className="card race-story-card">
            <BookOpenText className="icon red" />
            <div>
              <h3>Race Story</h3>
              <p>Overtakes, traffic, strategy and race-shaping events</p>
              <span className="new-badge">New</span>
            </div>
          </Link>

          {/* Original Analytics */}
          <Link to={getSeasonPath(CURRENT_SEASON, 'drivers')} className="card">
            <BarChart3 className="icon blue" />
            <div>
              <h3>Driver Bump Chart</h3>
              <p>See standings evolve round by round</p>
            </div>
          </Link>

          <Link to={getSeasonPath(CURRENT_SEASON, 'constructors')} className="card">
            <Rocket className="icon green" />
            <div>
              <h3>Constructor Bump Chart</h3>
              <p>Compare team performance and rankings</p>
            </div>
          </Link>

          <Link to={getSeasonPath(CURRENT_SEASON, 'driver-results')} className="card">
            <Users2 className="icon purple" />
            <div>
              <h3>Driver Results Table</h3>
              <p>Review qualifying vs. race vs. points</p>
            </div>
          </Link>

          <Link to={getSeasonPath(CURRENT_SEASON, 'driver-stats')} className="card">
            <Users2 className="icon orange" />
            <div>
              <h3>Driver Stat Comparison</h3>
              <p>Composite metrics & team comparisons</p>
            </div>
          </Link>

          <Link to={getSeasonPath(CURRENT_SEASON, 'head-to-head')} className="card">
            <BarChart3 className="icon red" />
            <div>
              <h3>Head-to-Head Comparison</h3>
              <p>Compare any two drivers side by side</p>
            </div>
          </Link>

          {/* New Live Analysis Features */}
          <Link to={getSeasonPath(CURRENT_SEASON, 'sector-analysis')} className="card live-analysis">
            <Timer className="icon cyan" />
            <div>
              <h3>Sector Time Analysis</h3>
              <p>Real-time sector performance comparison</p>
              <span className="new-badge">New</span>
            </div>
          </Link>

          <Link to={getSeasonPath(CURRENT_SEASON, 'pit-strategy')} className="card live-analysis">
            <Target className="icon pink" />
            <div>
              <h3>Pit Stop Strategy</h3>
              <p>Analyze pit timing and strategic decisions</p>
              <span className="new-badge">New</span>
            </div>
          </Link>

          <Link to={getSeasonPath(CURRENT_SEASON, 'pit-stop-analysis')} className="card live-analysis featured">
            <Activity className="icon yellow" />
            <div>
              <h3>Pit Stop Analysis</h3>
              <p>Compare crew service with full pit-lane time</p>
              <span className="new-badge">Timing</span>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Home;
