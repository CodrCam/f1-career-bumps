import { useMemo, useState, type CSSProperties } from 'react';
import {
  ArrowUpRight,
  Search,
  Users,
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { CorePageHeader } from '../components/CorePageHeader';
import { CorePageState } from '../components/CorePageState';
import { DriverIdentity } from '../components/DriverIdentity';
import type { AnalysisDriver } from '../data/analysisData';
import { useAnalysisData } from '../hooks/useAnalysisData';
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

const DriverDirectory = () => {
  const { seasonYear } = useParams();
  const year = getSeasonFromParam(seasonYear);
  const { envelope, status, error, retry } = useAnalysisData(year, 'drivers');
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
    if (groupMode === 'ranking') return [['Championship order', filtered] as const];
    const byTeam = new Map<string, AnalysisDriver[]>();
    filtered.forEach((driver) => {
      const key = driver.team ?? 'Team unavailable';
      const entries = byTeam.get(key) ?? [];
      entries.push(driver);
      byTeam.set(key, entries);
    });
    return [...byTeam.entries()].sort(([left], [right]) => left.localeCompare(right));
  }, [filtered, groupMode]);

  if (!envelope && status === 'loading') return <LoadingFrame label="Loading driver directory" />;
  if (!envelope) {
    return <CorePageState year={year} message={error?.message} onRetry={retry} />;
  }

  const formLeader = [...envelope.data.drivers].sort((left, right) => (
    formAverage(right) - formAverage(left)
  ))[0];

  return (
    <main className="core-page analysis-page">
      <CorePageHeader
        eyebrow={`Season ${year} / through round ${envelope.data.throughRound}`}
        title="Driver directory"
        description="Open a driver’s season profile, recent form, teammate context, and linked race evidence from one compact field index."
        meta={envelope.meta}
      />

      <MetricStrip
        label={`${year} driver field summary`}
        items={[
          { label: 'Drivers', value: envelope.data.drivers.length, detail: 'Season participants' },
          { label: 'Teams', value: envelope.data.teams.length, detail: 'Current identities' },
          {
            label: 'Form leader',
            value: formLeader?.name ?? '—',
            detail: formLeader ? `${formAverage(formLeader).toFixed(1)} points / last 3` : 'No races',
            definition: 'recent-form',
          },
          { label: 'Profiles', value: envelope.data.drivers.length, detail: 'Addressable season records' },
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
              { value: 'ranking', label: 'Ranking' },
              { value: 'team', label: 'Team' },
            ]}
            onChange={setGroupMode}
          />
        </FilterField>
      </FilterBar>

      <section className="driver-directory" aria-label={`${year} Formula 1 drivers`}>
        {groups.map(([label, drivers]) => (
          <div className="driver-directory__group" key={label}>
            <header>
              <span className="core-page__eyebrow">{groupMode === 'team' ? 'Team' : 'Field index'}</span>
              <h2>{label}</h2>
              <small>{drivers.length} driver{drivers.length === 1 ? '' : 's'}</small>
            </header>
            <div className="driver-directory__list">
              {drivers.map((driver) => (
                <Link
                  className="driver-directory__row"
                  key={driver.id}
                  to={`/${year}/drivers/${driver.id}`}
                  style={{ '--team-color': getTeamColor(driver.team) } as CSSProperties}
                >
                  <span className="driver-directory__rank">{String(driver.rank).padStart(2, '0')}</span>
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
                  <span className="driver-directory__latest">
                    <small>Latest</small>
                    <strong>{formatPosition(driver.latestFinish?.position ?? null)}</strong>
                  </span>
                  <span className="driver-directory__points">
                    <strong>{driver.points}</strong>
                    <small>points</small>
                  </span>
                  <ArrowUpRight aria-hidden="true" size={16} />
                </Link>
              ))}
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
