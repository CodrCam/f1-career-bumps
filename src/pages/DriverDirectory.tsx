import { useMemo, useState, type CSSProperties } from 'react';
import {
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  CircleMinus,
  Search,
  Users,
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { CorePageHeader } from '../components/CorePageHeader';
import { CorePageState } from '../components/CorePageState';
import { DriverIdentity } from '../components/DriverIdentity';
import type { AnalysisDriver } from '../data/analysisData';
import { useAnalysisData } from '../hooks/useAnalysisData';
import { useCoreData } from '../hooks/useCoreData';
import { FilterBar, FilterField, SegmentedControl } from '../ui/AnalysisControls';
import { LoadingFrame } from '../ui/LoadingFrame';
import { MetricStrip } from '../ui/MetricStrip';
import { getTeamColor } from '../utils/dataProcessing.js';
import { getSeasonFromParam } from '../utils/seasons.js';
import './AnalysisPages.css';

type GroupMode = 'ranking' | 'team';

const formAverage = (driver: AnalysisDriver) => {
  const sample = driver.recentForm.slice(-3);
  return sample.length
    ? sample.reduce((sum, result) => sum + result.points + result.sprintPoints, 0) / sample.length
    : 0;
};

const formatPosition = (position: number | null) => (
  position ? `P${position}` : 'NC'
);

const formatPoints = (value: number) => (
  Number.isInteger(value) ? String(value) : value.toFixed(1)
);

const identityKey = (value?: string) => (
  String(value ?? '').trim().toLocaleLowerCase()
);

const ChampionshipMovement = ({ movement }: { movement: number | null }) => {
  if (!movement) {
    return (
      <span className="driver-directory__movement is-level" aria-label="No championship position change">
        <CircleMinus aria-hidden="true" size={11} />
      </span>
    );
  }
  const gained = movement > 0;
  return (
    <span
      className={`driver-directory__movement ${gained ? 'is-up' : 'is-down'}`}
      aria-label={`${Math.abs(movement)} championship position${Math.abs(movement) === 1 ? '' : 's'} ${gained ? 'gained' : 'lost'}`}
    >
      {gained
        ? <ChevronUp aria-hidden="true" size={11} />
        : <ChevronDown aria-hidden="true" size={11} />}
      {Math.abs(movement)}
    </span>
  );
};

const DriverDirectory = () => {
  const { seasonYear } = useParams();
  const year = getSeasonFromParam(seasonYear);
  const { envelope, status, error, retry } = useAnalysisData(year, 'drivers');
  const { envelope: standingsEnvelope } = useCoreData(year, 'standings');
  const [team, setTeam] = useState('all');
  const [query, setQuery] = useState('');
  const [groupMode, setGroupMode] = useState<GroupMode>('ranking');

  const filtered = useMemo(() => (
    (envelope?.data.drivers ?? []).filter((driver) => (
      (team === 'all' || driver.team === team)
      && (!query || `${driver.name} ${driver.team}`.toLowerCase().includes(query.toLowerCase()))
    ))
  ), [envelope, query, team]);

  const groups = useMemo(() => {
    if (groupMode === 'ranking') return [['Driver championship', filtered] as const];
    const byTeam = new Map<string, AnalysisDriver[]>();
    filtered.forEach((driver) => {
      const key = driver.team ?? 'Team unavailable';
      const entries = byTeam.get(key) ?? [];
      entries.push(driver);
      byTeam.set(key, entries);
    });
    return [...byTeam.entries()].sort(([left], [right]) => left.localeCompare(right));
  }, [filtered, groupMode]);

  const standingsByDriver = useMemo(() => {
    const standings = new Map<string, NonNullable<typeof standingsEnvelope>['data']['driverStandings'][number]>();
    (standingsEnvelope?.data.driverStandings ?? []).forEach((standing) => {
      standings.set(identityKey(standing.name), standing);
      if (standing.code) standings.set(identityKey(standing.code), standing);
    });
    return standings;
  }, [standingsEnvelope]);

  if (!envelope && status === 'loading') return <LoadingFrame label="Loading driver directory" />;
  if (!envelope) {
    return <CorePageState year={year} message={error?.message} onRetry={retry} />;
  }

  const formLeader = [...envelope.data.drivers].sort((left, right) => (
    formAverage(right) - formAverage(left)
  ))[0];
  const championshipLeader = envelope.data.drivers[0];
  const championshipRunnerUp = envelope.data.drivers[1];
  const championshipLead = championshipLeader && championshipRunnerUp
    ? championshipLeader.points - championshipRunnerUp.points
    : null;

  return (
    <main className="core-page analysis-page">
      <CorePageHeader
        eyebrow={`Season ${year} / through round ${envelope.data.throughRound}`}
        title="Drivers"
        description="The complete championship order and every driver profile, with points, movement, recent form, teammate context, and linked race evidence in one place."
        meta={envelope.meta}
      />

      <MetricStrip
        label={`${year} driver championship and profile summary`}
        items={[
          {
            label: 'Championship leader',
            value: championshipLeader?.name ?? '—',
            detail: championshipLeader ? `${formatPoints(championshipLeader.points)} points` : 'No classification',
          },
          {
            label: 'Title lead',
            value: championshipLead === null ? '—' : formatPoints(championshipLead),
            detail: championshipRunnerUp ? `over ${championshipRunnerUp.name}` : 'No challenger classified',
          },
          {
            label: 'Form leader',
            value: formLeader?.name ?? '—',
            detail: formLeader ? `${formAverage(formLeader).toFixed(1)} points / last 3` : 'No races',
            definition: 'recent-form',
          },
          {
            label: 'Driver profiles',
            value: envelope.data.drivers.length,
            detail: `${envelope.data.teams.length} teams represented`,
          },
        ]}
      />

      <FilterBar title="Shape the driver field">
        <FilterField label="Find a driver">
          <span className="analysis-search">
            <Search aria-hidden="true" size={15} />
            <input
              type="search"
              value={query}
              placeholder="Name or team"
              onChange={(event) => setQuery(event.target.value)}
            />
          </span>
        </FilterField>
        <FilterField label="Team">
          <select value={team} onChange={(event) => setTeam(event.target.value)}>
            <option value="all">All teams</option>
            {envelope.data.teams.map((entry) => (
              <option key={entry} value={entry}>{entry}</option>
            ))}
          </select>
        </FilterField>
        <FilterField className="is-wide" label="Group by">
          <SegmentedControl
            label="Group driver directory"
            value={groupMode}
            options={[
              { value: 'ranking', label: 'Championship' },
              { value: 'team', label: 'Team' },
            ]}
            onChange={setGroupMode}
          />
        </FilterField>
      </FilterBar>

      <section className="driver-directory" aria-label={`${year} Formula 1 driver championship and profiles`}>
        {groups.map(([label, drivers]) => (
          <div className="driver-directory__group" key={label}>
            <header>
              <span className="core-page__eyebrow">{groupMode === 'team' ? 'Team' : 'Field index'}</span>
              <h2>{label}</h2>
              {groupMode === 'ranking' && (
                <small>{drivers.length} driver{drivers.length === 1 ? '' : 's'}</small>
              )}
            </header>
            <div className="driver-directory__list">
              {drivers.map((driver) => {
                const standing = standingsByDriver.get(identityKey(driver.name))
                  ?? standingsByDriver.get(identityKey(driver.code));
                const gapToLeader = standing?.gapToLeader
                  ?? Math.max(0, (championshipLeader?.points ?? driver.points) - driver.points);

                return (
                  <Link
                    className="driver-directory__row"
                    key={driver.id}
                    to={`/${year}/drivers/${driver.id}`}
                    style={{ '--team-color': getTeamColor(driver.team) } as CSSProperties}
                  >
                    <span className="driver-directory__rank">
                      <strong>{String(driver.rank).padStart(2, '0')}</strong>
                      <ChampionshipMovement movement={standing?.movement ?? null} />
                    </span>
                    <DriverIdentity
                      name={driver.name}
                      code={driver.code}
                      team={driver.team}
                      year={year}
                    />
                    <span className="driver-directory__form" aria-label={`${driver.name} recent form`}>
                      {driver.recentForm.map((result) => (
                        <i
                          className={result.position && result.position <= 3 ? 'is-podium' : ''}
                          key={result.round}
                        >
                          {formatPosition(result.position)}
                        </i>
                      ))}
                    </span>
                    <span className="driver-directory__gap">
                      <small>Leader gap</small>
                      <strong>{driver.rank === 1 ? 'Leader' : `+${formatPoints(gapToLeader)}`}</strong>
                    </span>
                    <span className="driver-directory__points">
                      <strong>{formatPoints(driver.points)}</strong>
                      <small>points</small>
                    </span>
                    <ArrowUpRight aria-hidden="true" size={16} />
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="driver-directory__empty">
            <Users aria-hidden="true" size={25} />
            <h2>No drivers match those filters.</h2>
            <p>Clear the team or search field to restore the full grid.</p>
          </div>
        )}
      </section>
    </main>
  );
};

export default DriverDirectory;
