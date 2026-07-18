import React from 'react';
import { getDriverMarkConfig } from '../data/driverIdentities.js';
import { getDriverColor } from '../utils/dataProcessing.js';
import './DriverMark.css';

const DriverMark = ({
  driver,
  team,
  year = 2026,
  size = 'md',
  className = '',
  decorative = true,
  tone = 'team',
}) => {
  const config = getDriverMarkConfig(driver, year);
  if (!config) return null;

  const markPath = `${import.meta.env.BASE_URL}${config.path}`;
  const color = tone === 'white'
    ? '#f8fafc'
    : getDriverColor(config.label, team || config.team, year);

  return (
    <span
      aria-hidden={decorative ? 'true' : undefined}
      aria-label={decorative ? undefined : `${config.label}, number ${config.number}`}
      className={`driver-mark driver-mark--${size} ${className}`.trim()}
      role={decorative ? undefined : 'img'}
      style={{
        '--driver-mark-color': color,
        '--driver-mark-image': `url("${markPath}")`,
      }}
      title={`${config.label} #${config.number}`}
    >
      <span className="driver-mark__art" />
    </span>
  );
};

export default DriverMark;
