import type { CSSProperties } from 'react';
import {
  ChevronDown,
  ChevronUp,
  CircleMinus,
  Trophy,
  Users,
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { CorePageHeader } from '../components/CorePageHeader';
import { CorePageState } from '../components/CorePageState';
import TeamLogo from '../components/TeamLogo.jsx';
import type {
  ConstructorStanding,
} from '../data/coreData';
import type { Standing } from '../data/seasonOverview';
import { useCoreData } from '../hooks/useCoreData';
import { LoadingFrame } from '../ui/LoadingFrame';
import { MetricStrip } from '../ui/MetricStrip';
import { getTeamColor } from '../utils/dataProcessing.js';
import { getSeasonFromParam } from '../utils/seasons.js';
import './CorePages.css';

const formatPoints = (value: number) => (
  Number.isInteger(value) ? value : value.toFixed(1)
);

const Movement = ({ movement }: { movement: number | null }) => {
  if (!movement) {
    return (
      <span className="standing-movement is-level" aria-label="No position change">
        <CircleMinus aria-hidden="true" size={14} />
      </span>
    );
  }
  const gained = movement > 0;
  return (
    <span
      className={`standing-movement ${gained ? 'is-up' : 'is-down'}`}
      aria-label={`${Math.abs(movement)} position${Math.abs(movement) === 1 ? '' : 's'} ${gained ? 'gained' : 'lost'}`}
    >
      {gained
        ? <ChevronUp aria-hidden="true" size={14} />
        : <ChevronDown aria-hidden="true" size={14} />}
      {Math.abs(movement)}
    </span>
  );
};

interface ChampionshipStandingsProps {
  mode: 'drivers' | 'constructors';
}

const DriverRow = ({ standing, year }: { standing: Standing; year: number }) => (
  <li
    className="standing-row"
    style={{ '--team-color': getTeamColor(standing.team) } as CSSProperties}
  >
    <span className="standing-row__rank">{String(standing.rank).padStart(2, '0')}</span>
    <span className="standing-row__mark">
      <TeamLogo size="sm" team={standing.team} tone="team" year={year} />
    </span>
    <span className="standing-row__identity">
      <strong>{standing.name}</strong>
      <small>{standing.team ?? 'Independent entry'}</small>
    </span>
    <Movement movement={standing.movement} />
    <span className="standing-row__gap">
      {standing.rank === 1 ? 'Leader' : `+${formatPoints(standing.gapToLeader)}`}
      <small>{standing.gapToAhead ? `+${formatPoints(standing.gapToAhead)} ahead` : 'championship'}</small>
    </span>
    <strong className="standing-row__points">{formatPoints(standing.points)}<small>PTS</small></strong>
  </li>
);

const ConstructorRow = ({
  standing,
  year,
}: {
  standing: ConstructorStanding;
  year: number;
}) => (
  <li
    className="standing-row standing-row--constructor"
    style={{ '--team-color': getTeamColor(standing.name) } as CSSProperties}
  >
    <span className="standing-row__rank">{String(standing.rank).padStart(2, '0')}</span>
    <span className="standing-row__mark">
      <TeamLogo size="sm" team={standing.name} tone="team" year={year} />
    </span>
    <span className="standing-row__identity">
      <strong>{standing.name}</strong>
      <small>
        {standing.drivers.map((driver) => (
          `${driver.name} ${formatPoints(driver.points)}`
        )).join(' · ')}
      </small>
    </span>
    <Movement movement={standing.movement} />
    <span className="standing-row__gap">
      {standing.rank === 1 ? 'Leader' : `+${formatPoints(standing.gapToLeader)}`}
      <small>{standing.gapToAhead ? `+${formatPoints(standing.gapToAhead)} ahead` : 'championship'}</small>
    </span>
    <strong className="standing-row__points">{formatPoints(standing.points)}<small>PTS</small></strong>
  </li>
);

const ChampionshipStandings = ({ mode }: ChampionshipStandingsProps) => {
  const { seasonYear } = useParams();
  const year = getSeasonFromParam(seasonYear);
  const { envelope, status, error, retry } = useCoreData(year, 'standings');

  if (!envelope && status === 'loading') return <LoadingFrame label="Loading championship order" />;
  if (!envelope) {
    return <CorePageState year={year} message={error?.message} onRetry={retry} />;
  }

  const standings = mode === 'drivers'
    ? envelope.data.driverStandings
    : envelope.data.constructorStandings;
  const leader = standings[0];
  const closest = standings[1];
  const changed = standings.filter((standing) => standing.movement).length;
  const counterpart = mode === 'drivers'
    ? `/${year}/standings/constructors`
    : `/${year}/standings/drivers`;
  const Icon = mode === 'drivers' ? Trophy : Users;

  return (
    <main className="core-page">
      <CorePageHeader
        eyebrow={`Season ${year} / through round ${envelope.data.throughRound}`}
        title={mode === 'drivers' ? 'Driver championship' : 'Constructor championship'}
        description={mode === 'drivers'
          ? 'The complete title order, with the latest-round movement and the gaps that matter.'
          : 'Every team in title order, with each driver’s current contribution kept in view.'}
        meta={envelope.meta}
        actions={(
          <Link className="core-page__switch" to={counterpart}>
            <Icon aria-hidden="true" size={15} />
            {mode === 'drivers' ? 'View teams' : 'View drivers'}
          </Link>
        )}
      />

      <MetricStrip
        label={`${year} championship snapshot`}
        items={[
          { label: 'Leader', value: leader?.name ?? '—', detail: `${leader?.points ?? 0} points` },
          {
            label: 'Lead',
            value: closest ? formatPoints(closest.gapToLeader) : '—',
            detail: closest ? `over ${closest.name}` : 'No challenger classified',
          },
          { label: 'Movers', value: changed, detail: 'Changed position last round' },
          { label: 'Classified', value: standings.length, detail: mode },
        ]}
      />

      <section className="standings-board" aria-label={`${year} ${mode} championship standings`}>
        <div className="standings-board__head" aria-hidden="true">
          <span>Rank</span>
          <span>Entry</span>
          <span>Move</span>
          <span>Gap</span>
          <span>Points</span>
        </div>
        <ol>
          {mode === 'drivers'
            ? envelope.data.driverStandings.map((standing) => (
              <DriverRow key={standing.name} standing={standing} year={year} />
            ))
            : envelope.data.constructorStandings.map((standing) => (
              <ConstructorRow key={standing.name} standing={standing} year={year} />
            ))}
        </ol>
      </section>
    </main>
  );
};

export const DriverStandings = () => <ChampionshipStandings mode="drivers" />;
export const ConstructorStandings = () => <ChampionshipStandings mode="constructors" />;

export default ChampionshipStandings;
