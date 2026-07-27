import type { CSSProperties } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  CircleMinus,
  Gauge,
  GitCompareArrows,
  Route,
  Timer,
  Trophy,
  Users,
  Wrench,
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import TeamLogo from '../components/TeamLogo.jsx';
import { getTeamColor } from '../utils/dataProcessing.js';
import {
  getSeasonFromParam,
} from '../utils/seasons.js';
import { useSeasonOverview } from '../hooks/useSeasonOverview';
import { DataStatus } from '../ui/DataStatus';
import { LoadingFrame } from '../ui/LoadingFrame';
import { MetricStrip } from '../ui/MetricStrip';
import type {
  PublicationState,
  Standing,
} from '../data/seasonOverview';
import './SeasonDesk.css';

const publicationLabels: Record<PublicationState, string> = {
  scheduled: 'Scheduled',
  awaiting_results: 'Results pending',
  results_ready: 'Results ready',
  awaiting_timing: 'Story processing',
  timing_ready: 'Timing received',
  published: 'Story ready',
  degraded: 'Limited timing',
  failed: 'Refresh failed',
};

const formatRaceDate = (value?: string) => {
  if (!value) return 'Date unavailable';
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
};

const formatPoints = (points: number) => (
  Number.isInteger(points) ? points : points.toFixed(1)
);

const Movement = ({ value }: { value: number | null }) => {
  if (!value) {
    return (
      <span className="desk-movement is-level" aria-label="No championship position change">
        <CircleMinus aria-hidden="true" size={12} />
      </span>
    );
  }

  const gained = value > 0;
  return (
    <span
      className={`desk-movement ${gained ? 'is-up' : 'is-down'}`}
      aria-label={`${Math.abs(value)} position${Math.abs(value) === 1 ? '' : 's'} ${gained ? 'gained' : 'lost'}`}
    >
      {gained
        ? <ChevronUp aria-hidden="true" size={13} />
        : <ChevronDown aria-hidden="true" size={13} />}
      {Math.abs(value)}
    </span>
  );
};

const StandingRow = ({ standing, year }: { standing: Standing; year: number }) => (
  <li
    className="desk-standing"
    style={{ '--team-color': getTeamColor(standing.team ?? standing.name) } as CSSProperties}
  >
    <span className="desk-standing__rank">{String(standing.rank).padStart(2, '0')}</span>
    <span className="desk-standing__identity">
      {standing.team && (
        <TeamLogo size="xs" team={standing.team} tone="team" year={year} />
      )}
      <span>
        <strong>{standing.name}</strong>
        <small>{standing.team ?? `Gap ${standing.gapToLeader}`}</small>
      </span>
    </span>
    <Movement value={standing.movement} />
    <strong className="desk-standing__points">{formatPoints(standing.points)}</strong>
  </li>
);

const SeasonDesk = () => {
  const { seasonYear } = useParams();
  const year = getSeasonFromParam(seasonYear);
  const {
    overview,
    status,
    error,
    retry,
  } = useSeasonOverview(year);

  if (!overview && status === 'loading') {
    return <LoadingFrame />;
  }

  if (!overview || (status === 'error' && !overview)) {
    return (
      <main className="season-desk season-desk--error">
        <span className="season-desk__eyebrow">Season {year}</span>
        <h1>The season desk could not load.</h1>
        <p>{error?.message ?? 'The data service did not return a usable season overview.'}</p>
        <button type="button" onClick={retry}>Try again</button>
      </main>
    );
  }

  const { data, meta } = overview;
  const latestRace = data.latestRace;
  const raceDestination = latestRace
    ? `/${year}/races/${latestRace.round}`
    : `/${year}/races`;
  const driverLeader = data.driverStandings[0];
  const constructorLeader = data.constructorStandings[0];
  const workbench = [
    {
      index: '01',
      title: 'Championship movement',
      detail: 'Follow every lead change, gap, and position swing.',
      path: `/${year}/drivers`,
      icon: Trophy,
    },
    {
      index: '02',
      title: 'Driver comparison',
      detail: 'Put qualifying, race, sprint, and points records side by side.',
      path: `/${year}/compare`,
      icon: GitCompareArrows,
    },
    {
      index: '03',
      title: 'Pace lab',
      detail: 'Inspect sector shape and consistency across the field.',
      path: `/${year}/pace`,
      icon: Gauge,
    },
    {
      index: '04',
      title: 'Pit lane',
      detail: 'Separate service speed from the total cost of the stop.',
      path: `/${year}/pit-lane`,
      icon: Wrench,
    },
  ];

  return (
    <main className="season-desk">
      <header className="season-desk__header">
        <div>
          <span className="season-desk__eyebrow">Season {year} / live desk</span>
          <h1>The championship, as it moves.</h1>
          <p>
            Official results, current title order, and race analysis in one
            working view.
          </p>
        </div>
        <DataStatus
          compact
          state={meta.state}
          updatedAt={meta.publishedAt}
        />
      </header>

      <section className="season-desk__command" aria-label={`${year} season overview`}>
        <article className="desk-latest">
          <div className="desk-latest__rail">
            <span>Latest classified race</span>
            <span>R{latestRace?.round ?? '—'}</span>
          </div>

          {latestRace ? (
            <>
              <div className="desk-latest__heading">
                <div>
                  <span className={`desk-state state-${latestRace.state}`}>
                    {publicationLabels[latestRace.state]}
                  </span>
                  <h2>{latestRace.grandPrix}</h2>
                  <p>{formatRaceDate(latestRace.date)}{latestRace.circuit ? ` · ${latestRace.circuit}` : ''}</p>
                </div>
                <Route aria-hidden="true" size={30} strokeWidth={1.5} />
              </div>

              <ol className="desk-podium" aria-label={`${latestRace.grandPrix} podium`}>
                {latestRace.podium.map((result) => {
                  const gridDelta = result.grid && result.position
                    ? result.grid - result.position
                    : null;
                  return (
                    <li
                      key={`${result.position}-${result.driver}`}
                      style={{ '--team-color': getTeamColor(result.team) } as CSSProperties}
                    >
                      <span className="desk-podium__position">P{result.position}</span>
                      <span className="desk-podium__team">
                        <TeamLogo size="sm" team={result.team} tone="team" year={year} />
                      </span>
                      <span className="desk-podium__driver">
                        <strong>{result.driver ?? result.code ?? 'Driver'}</strong>
                        <small>{result.team}</small>
                      </span>
                      <span className="desk-podium__delta">
                        {gridDelta === null
                          ? 'Grid —'
                          : gridDelta === 0
                            ? 'Held grid'
                            : `${gridDelta > 0 ? '+' : ''}${gridDelta} from grid`}
                      </span>
                      <strong className="desk-podium__points">+{formatPoints(result.points)}</strong>
                    </li>
                  );
                })}
              </ol>

              <div className="desk-latest__action">
                <DataStatus
                  state={latestRace.state}
                  updatedAt={latestRace.updatedAt ?? meta.publishedAt}
                />
                <Link to={raceDestination}>
                  Open race analysis
                  <ArrowUpRight aria-hidden="true" size={16} />
                </Link>
              </div>
            </>
          ) : (
            <div className="desk-latest__empty">
              <Timer aria-hidden="true" size={28} />
              <h2>No classified race yet</h2>
              <p>The desk will publish the first official classification here.</p>
            </div>
          )}
        </article>

        <aside className="desk-championship" aria-labelledby="championship-pulse-title">
          <div className="desk-championship__heading">
            <div>
              <span>Championship pulse</span>
              <h2 id="championship-pulse-title">Drivers</h2>
            </div>
            <Link to={`/${year}/drivers`} aria-label="Open driver championship and profiles">
              <ArrowRight aria-hidden="true" size={17} />
            </Link>
          </div>

          <ol className="desk-standings">
            {data.driverStandings.slice(0, 5).map((standing) => (
              <StandingRow key={standing.name} standing={standing} year={year} />
            ))}
          </ol>

          <div className="desk-championship__leaders">
            <span>
              Driver leader
              <strong>{driverLeader?.name ?? '—'}</strong>
            </span>
            <span>
              Constructor leader
              <strong>{constructorLeader?.name ?? '—'}</strong>
            </span>
          </div>
        </aside>
      </section>

      <MetricStrip
        label={`${year} publication coverage`}
        items={[
          {
            label: 'Rounds complete',
            value: data.completedRounds,
            detail: 'Official classifications',
          },
          {
            label: 'Stories ready',
            value: data.coverage.storyReadyRounds,
            detail: `${data.coverage.incompleteRounds.length} awaiting detail`,
          },
          {
            label: 'Championship leader',
            value: driverLeader?.points ?? '—',
            detail: driverLeader ? `${driverLeader.name} · points` : 'No results',
          },
          {
            label: 'API contract',
            value: meta.schemaVersion,
            detail: meta.sources.join(' · ') || 'Published season data',
          },
        ]}
      />

      <section className="desk-workbench" aria-labelledby="workbench-title">
        <div className="desk-workbench__heading">
          <span className="season-desk__eyebrow">Analysis workbench</span>
          <h2 id="workbench-title">Move from result to explanation.</h2>
          <p>Each workspace keeps the same season, source, and freshness context.</p>
        </div>

        <div className="desk-workbench__routes">
          {workbench.map(({ index, title, detail, path, icon: Icon }) => (
            <Link key={title} to={path}>
              <span className="desk-workbench__index">{index}</span>
              <Icon aria-hidden="true" size={19} strokeWidth={1.6} />
              <span>
                <strong>{title}</strong>
                <small>{detail}</small>
              </span>
              <ArrowUpRight aria-hidden="true" size={17} />
            </Link>
          ))}
        </div>
      </section>

      <section className="desk-coverage" aria-labelledby="coverage-title">
        <div>
          <span className="season-desk__eyebrow">Publication coverage</span>
          <h2 id="coverage-title">
            {data.coverage.storyReadyRounds} of {data.coverage.completedRounds} race stories ready
          </h2>
        </div>
        <div
          className="desk-coverage__track"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={Math.max(data.coverage.completedRounds, 1)}
          aria-valuenow={data.coverage.storyReadyRounds}
          aria-label="Race story publication coverage"
        >
          <span
            style={{
              width: `${data.coverage.completedRounds
                ? (data.coverage.storyReadyRounds / data.coverage.completedRounds) * 100
                : 0}%`,
            }}
          />
        </div>
        {data.coverage.incompleteRounds.length > 0 && (
          <p>
            Processing: {data.coverage.incompleteRounds
              .map((race) => `R${race.round} ${race.grandPrix}`)
              .join(' · ')}
          </p>
        )}
      </section>
    </main>
  );
};

export default SeasonDesk;
