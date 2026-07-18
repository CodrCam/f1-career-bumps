import React from 'react';
import { getTeamLogoConfig } from '../data/teamLogos.js';
import './TeamLogo.css';

const TeamLogo = ({
  team,
  year = 2026,
  size = 'md',
  className = '',
  decorative = true,
}) => {
  const config = getTeamLogoConfig(team, year);
  if (!config) return null;

  return (
    <span
      className={`team-logo team-logo--${size} ${className}`.trim()}
      title={config.label}
    >
      <img
        alt={decorative ? '' : `${config.label} team logo`}
        aria-hidden={decorative ? 'true' : undefined}
        draggable="false"
        loading="lazy"
        src={`${import.meta.env.BASE_URL}${config.path}`}
      />
    </span>
  );
};

export default TeamLogo;

