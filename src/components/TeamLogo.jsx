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
  const isFerrariSplit = config.key === 'ferrari';

  return (
    <span
      aria-hidden={decorative ? 'true' : undefined}
      aria-label={decorative ? undefined : `${config.label} team logo`}
      className={`team-logo team-logo--${size} team-logo--${isTeamTone ? 'team' : 'white'} ${isFerrariSplit ? 'team-logo--ferrari-split' : ''} ${className}`.trim()}
      role={decorative ? undefined : 'img'}
      style={isTeamTone || isFerrariSplit ? {
        '--team-logo-color': config.color,
        '--team-logo-image': `url("${logoPath}")`,
      } : undefined}
      title={config.label}
    >
      {isFerrariSplit ? (
        <>
          <span className="team-logo__ferrari-base" />
          <img
            alt=""
            className="team-logo__ferrari-art"
            draggable="false"
            loading="lazy"
            src={logoPath}
          />
        </>
      ) : isTeamTone ? (
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
