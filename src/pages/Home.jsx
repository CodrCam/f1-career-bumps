import React from "react";
import { Link } from "react-router-dom";
import { Rocket, BarChart3, Users2, Info, Timer, Target, Zap } from "lucide-react";

const Home = () => {
  return (
    <div className="home-container">
      <div className="home-content">
        <h1 className="home-title">F1 Performance Dashboard</h1>
        <p className="home-subtitle">
          Explore comprehensive F1 analytics including driver standings, race analysis, and real-time telemetry insights.
        </p>

        <div className="card-grid">
          {/* Original Analytics */}
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

          {/* New Live Analysis Features */}
          <Link to="/sector-analysis" className="card live-analysis">
            <Timer className="icon cyan" />
            <div>
              <h3>Sector Time Analysis</h3>
              <p>Real-time sector performance comparison</p>
              <span className="new-badge">New</span>
            </div>
          </Link>

          <Link to="/pit-strategy" className="card live-analysis">
            <Target className="icon pink" />
            <div>
              <h3>Pit Stop Strategy</h3>
              <p>Analyze pit timing and strategic decisions</p>
              <span className="new-badge">New</span>
            </div>
          </Link>

          <Link to="/pit-stop-analysis" className="card live-analysis featured">
            <Zap className="icon yellow" />
            <div>
              <h3>Pit Stop Predictions</h3>
              <p>AI-powered fastest pit stop predictions</p>
              <span className="new-badge">Featured</span>
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

        <div className="feature-highlight">
          <h2>🚀 New: Pit Stop Prediction Engine</h2>
          <p>
            Our latest feature uses advanced analytics to predict which team will achieve the fastest pit stop 
            in upcoming races. Using historical data from 2025 season pit stops, the algorithm considers consistency, 
            average speed, position rankings, and win rates to generate predictive scores. Get ahead of the competition 
            with data-driven pit stop insights!
          </p>
        </div>

        <div className="feature-highlight">
          <h2>🏁 Enhanced F1 Analysis Suite</h2>
          <p>
            Powered by OpenF1 API and comprehensive 2025 season data, our analysis tools provide deep insights into 
            sector times, pit strategies, and performance predictions. Experience F1 data like never before with 
            interactive visualizations and comprehensive telemetry analysis.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Home;