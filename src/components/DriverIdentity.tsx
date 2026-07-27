import DriverMark from './DriverMark.jsx';
import TeamLogo from './TeamLogo.jsx';

interface DriverIdentityProps {
  name: string;
  team?: string;
  code?: string;
  year: number;
  detail?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const DriverIdentity = ({
  name,
  team,
  code,
  year,
  detail,
  size = 'sm',
}: DriverIdentityProps) => (
  <span className={`analysis-driver-identity is-${size}`}>
    <span className="analysis-driver-identity__marks" aria-hidden="true">
      <DriverMark driver={name} size={size} team={team} year={year} />
      <TeamLogo size={size === 'lg' ? 'sm' : 'xs'} team={team} tone="team" year={year} />
    </span>
    <span>
      <strong>{name}</strong>
      <small>{detail ?? [code, team].filter(Boolean).join(' · ')}</small>
    </span>
  </span>
);
