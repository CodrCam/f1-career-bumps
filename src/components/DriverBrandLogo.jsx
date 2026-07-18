import React from 'react';
import { getDriverBrandLogo } from '../data/driverBrandLogos.js';
import { getDriverColor } from '../utils/dataProcessing.js';
import DriverMark from './DriverMark.jsx';
import './DriverBrandLogo.css';

const DriverBrandLogo = ({
  driver,
  team,
  year = 2026,
  size = 'md',
  className = '',
  decorative = true,
  tone = 'team',
}) => {
  const logoPath = getDriverBrandLogo(driver);
  if (!logoPath) {
    return (
      <DriverMark
        className={`driver-brand-logo__fallback ${className}`.trim()}
        decorative={decorative}
        driver={driver}
        size={size}
        team={team}
        tone={tone}
        year={year}
      />
    );
  }

  const color = tone === 'white'
    ? '#f8fafc'
    : getDriverColor(driver, team, year);
  const imagePath = `${import.meta.env.BASE_URL}${logoPath}`;

  return (
    <span
      aria-hidden={decorative ? 'true' : undefined}
      aria-label={decorative ? undefined : `${driver} personal logo`}
      className={`driver-brand-logo driver-brand-logo--${size} ${className}`.trim()}
      role={decorative ? undefined : 'img'}
      style={{
        '--driver-brand-color': color,
        '--driver-brand-image': `url("${imagePath}")`,
      }}
      title={`${driver} personal logo`}
    >
      <span className="driver-brand-logo__art" />
    </span>
  );
};

export default DriverBrandLogo;

