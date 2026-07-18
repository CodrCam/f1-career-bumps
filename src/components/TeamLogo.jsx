import React from 'react';
import { getTeamLogoConfig } from '../data/teamLogos.js';
import './TeamLogo.css';

const TeamLogo = ({
  team,
  year = 2026,
  size = 'md',
  className = '',
  decorative = true,
  tone = 'white',
}) => {
  const config = getTeamLogoConfig(team, year);
  if (!config) return null;
  const logoPath = `${import.meta.env.BASE_URL}${config.path}`;
  const isTeamTone = tone === 'team';

  return (
    <span
      aria-hidden={decorative ? 'true' : undefined}
      aria-label={decorative ? undefined : `${config.label} team logo`}
      className={`team-logo team-logo--${size} team-logo--${isTeamTone ? 'team' : 'white'} ${className}`.trim()}
      role={decorative ? undefined : 'img'}
      style={isTeamTone ? {
        '--team-logo-color': config.color,
        '--team-logo-image': `url("${logoPath}")`,
      } : undefined}
      title={config.label}
    >
      {isTeamTone ? (
        <span className="team-logo__mark" />
      ) : (
        <img
          alt=""
          draggable="false"
          loading="lazy"
          src={logoPath}
        />
      )}
    </span>
  );
};

export default TeamLogo;
