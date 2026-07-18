import React from 'react';
import TeamCarMark from './TeamCarMark.jsx';
import TeamLogo from './TeamLogo.jsx';
import { SEASON_2026_GRID, TEAM_CAR_CONFIG } from '../data/seasonGrid.js';

const SeasonGrid = () => (
  <section className="season-grid-section" aria-labelledby="season-grid-title">
    <div className="season-grid-heading">
      <div>
        <span className="section-kicker">The 2026 field</span>
        <h2 id="season-grid-title">Eleven teams. Twenty-two cars.</h2>
      </div>
      <span className="grid-season-stamp">2026</span>
    </div>

    <div className="grid-formation">
      {SEASON_2026_GRID.map(({ team, drivers }, index) => {
        const config = TEAM_CAR_CONFIG[team];

        return (
          <article
            className="grid-team"
            key={team}
            style={{ '--team-accent': config.accent }}
          >
            <div className="grid-team-header">
              <span className="grid-position">{String(index + 1).padStart(2, '0')}</span>
              <span className="grid-team-identity">
                <TeamLogo size="xs" team={config.name} year={2026} />
                <span>{config.name}</span>
              </span>
              <span className="grid-team-code">{config.shortName}</span>
            </div>

            <div className="grid-driver-list">
              {drivers.map((driver) => (
                <div className="grid-driver" key={driver}>
                  <TeamCarMark compact team={team} />
                  <span>{driver}</span>
                </div>
              ))}
            </div>
          </article>
        );
      })}
    </div>
  </section>
);

export default SeasonGrid;
