import React from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  BarChart3,
  Database,
  Gauge,
  GitCompareArrows,
  RefreshCw,
  Route,
} from "lucide-react";
import { CURRENT_SEASON, getSeasonPath } from "../utils/seasons.js";
import "./About.css";

const capabilities = [
  {
    accent: "cyan",
    description: "Follow driver and constructor standings as they evolve from race to race, with points, position changes, and the current order in view.",
    icon: BarChart3,
    label: "Championship movement",
    path: getSeasonPath(CURRENT_SEASON, "drivers"),
  },
  {
    accent: "red",
    description: "Compare race results, performance trends, and direct head-to-head records without losing the context of the full season.",
    icon: GitCompareArrows,
    label: "Driver form",
    path: getSeasonPath(CURRENT_SEASON, "driver-stats"),
  },
  {
    accent: "amber",
    description: "Explore sector pace, pit-stop timing, strategy windows, and directional pit-performance forecasts from completed sessions.",
    icon: Gauge,
    label: "Pace and strategy",
    path: getSeasonPath(CURRENT_SEASON, "pit-strategy"),
  },
  {
    accent: "pink",
    description: "Read a race through overtakes, traffic, position changes, opportunity conversion, and the moments that altered its shape.",
    icon: Route,
    label: "The race story",
    path: `/${CURRENT_SEASON}/race-story`,
  },
];

const technicalHighlights = [
  {
    detail: "Completed-race classifications are collected, validated, and normalized into a consistent season structure.",
    icon: RefreshCw,
    label: "Official-results pipeline",
  },
  {
    detail: "Season and race-story records live in DynamoDB behind a public, read-only AWS API.",
    icon: Database,
    label: "Season data platform",
  },
  {
    detail: "React and Chart.js turn that data into responsive, filterable views for desktop and mobile.",
    icon: BarChart3,
    label: "Interactive visualization",
  },
];

const About = () => (
  <main className="about-page">
    <div className="about-shell">
      <header className="about-intro">
        <span className="about-kicker">About Slipstream</span>
        <h1>The season, in motion.</h1>
        <p className="about-lead">
          Slipstream is a Formula 1 data desk for following how championships,
          drivers, and race strategy change over time. It brings season-long
          context and race-weekend detail into one focused place.
        </p>
        <p className="about-credit">Created and maintained by Cameron Griffin.</p>
      </header>

      <section className="about-section" aria-labelledby="about-explore-title">
        <div className="about-section-heading">
          <span>Explore</span>
          <h2 id="about-explore-title">A clearer view of the championship</h2>
        </div>

        <div className="about-capability-grid">
          {capabilities.map(({ accent, description, icon: Icon, label, path }) => (
            <Link
              className={`about-capability ${accent}`}
              key={label}
              to={path}
            >
              <div className="about-capability-icon">
                <Icon aria-hidden="true" size={22} />
              </div>
              <div>
                <h3>{label}</h3>
                <p>{description}</p>
              </div>
              <ArrowUpRight aria-hidden="true" className="about-capability-arrow" size={20} />
            </Link>
          ))}
        </div>
      </section>

      <section className="about-section about-technical" aria-labelledby="about-technical-title">
        <div className="about-section-heading">
          <span>Under the hood</span>
          <h2 id="about-technical-title">Built as a real data product</h2>
          <p>
            The interface stays focused while collection, storage, and updates
            run behind a small read-only data service.
          </p>
        </div>

        <div className="about-technical-grid">
          {technicalHighlights.map(({ detail, icon: Icon, label }) => (
            <div className="about-technical-item" key={label}>
              <Icon aria-hidden="true" size={21} />
              <h3>{label}</h3>
              <p>{detail}</p>
            </div>
          ))}
        </div>

        <p className="about-model-note">
          Pit forecasts are directional statistical estimates based on observed
          performance trends. Official results and modeled views remain clearly
          separated throughout the site.
        </p>
      </section>

      <footer className="about-footer">
        <div>
          <span>Current season</span>
          <strong>{CURRENT_SEASON}</strong>
        </div>
        <nav aria-label="About page destinations">
          <Link to={getSeasonPath(CURRENT_SEASON, "drivers")}>
            Open championship
            <ArrowUpRight aria-hidden="true" size={17} />
          </Link>
          <Link to={`/${CURRENT_SEASON}/race-story`}>
            Read the race story
            <ArrowUpRight aria-hidden="true" size={17} />
          </Link>
        </nav>
      </footer>
    </div>
  </main>
);

export default About;
