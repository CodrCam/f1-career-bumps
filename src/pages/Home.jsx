import React from "react";
import { Link } from "react-router-dom";
import { Rocket, BarChart3, Users2, Info } from "lucide-react";

const Home = () => {
  return (
    <div className="home-container">
      <div className="home-content">
        <h1 className="home-title">F1 Performance Dashboard</h1>
        <p className="home-subtitle">
          Explore six core categories of driver and constructor analytics for the 2025 season.
        </p>

        <div className="card-grid">
          <Link to="/2025-drivers" className="card">
            <BarChart3 className="icon blue" />
            <div>
              <h3>Driver Bump Chart</h3>
              <p>See 2025 standings evolve round by round</p>
            </div>
          </Link>

          <Link to="/2025-constructors" className="card">
            <Rocket className="icon green" />
            <div>
              <h3>Constructor Bump Chart</h3>
              <p>Compare team performance and rankings</p>
            </div>
          </Link>

          <Link to="/driver-results" className="card">
            <Users2 className="icon purple" />
            <div>
              <h3>Driver Results Table</h3>
              <p>Review qualifying vs. race vs. points</p>
            </div>
          </Link>

          <Link to="/driver-stats" className="card">
            <Users2 className="icon orange" />
            <div>
              <h3>Driver Stat Comparison</h3>
              <p>Composite metrics & team comparisons</p>
            </div>
          </Link>

          <Link to="/head-to-head" className="card">
            <BarChart3 className="icon red" />
            <div>
              <h3>Head-to-Head Comparison</h3>
              <p>Compare any two drivers side by side</p>
            </div>
          </Link>

          <Link to="/about" className="card">
            <Info className="icon gray" />
            <div>
              <h3>About This Project</h3>
              <p>Tech stack, goals & data sources</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Home;