import { useMemo, type CSSProperties } from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  Flag,
  Trophy,
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { CorePageHeader } from '../components/CorePageHeader';
import { CorePageState } from '../components/CorePageState';
import { DriverIdentity } from '../components/DriverIdentity';
import DriverMark from '../components/DriverMark.jsx';
import TeamLogo from '../components/TeamLogo.jsx';
import type { DriverRoundResult } from '../data/analysisData';
import { useAnalysisData } from '../hooks/useAnalysisData';
import { DefinitionLink } from '../ui/DefinitionLink';
import { LoadingFrame } from '../ui/LoadingFrame';
import { MetricStrip } from '../ui/MetricStrip';
import { ResponsiveDataView, type DataColumn } from '../ui/ResponsiveDataView';
import { getTeamColor } from '../utils/dataProcessing.js';
import { getSeasonFromParam } from '../utils/seasons.js';
import './AnalysisPages.css';

const formatAverage = (value: number | null) => (
  value === null ? '—' : value.toFixed(1)
);

const formatPosition = (value: number | null) => (
  value ? `P${value}` : 'NC'
);

const DriverProfile = () => {
  const { seasonYear, driverId } = useParams();
  const year = getSeasonFromParam(seasonYear);
  const { envelope, status, error, retry } = useAnalysisData(
    year,
    'driver',
    driverId,
  );

  const evidenceColumns = useMemo<Array<DataColumn<DriverRoundResult>>>(() => [
    {
      id: 'race',
      header: 'Race',
      render: (result) => (
        <Link className="analysis-table-link" to={`/${year}/races/${result.round}`}>
          <strong>R{result.round} · {result.grandPrix}</strong>
          <small>{result.team}</small>
        </Link>
      ),
    },
    {
      id: 'qualifying',
      header: 'Qualifying',
      align: 'center',
      render: (result) => formatPosition(result.qualifying),
    },
    {
      id: 'grid',
      header: 'Grid',
      align: 'center',
      render: (result) => formatPosition(result.grid),
    },
    {
      id: 'finish',
      header: 'Finish',
      align: 'center',
      render: (result) => formatPosition(result.position),
    },
    {
      id: 'delta',
      header: 'Grid Δ',
      align: 'center',
      render: (result) => (
        result.gridDelta === null ? '—' : `${result.gridDelta > 0 ? '+' : ''}${result.gridDelta}`
      ),
    },
    {
      id: 'points',
      header: 'Points',
      align: 'right',
      render: (result) => result.points + result.sprintPoints,
    },
  ], [year]);

  if (!envelope && status === 'loading') return <LoadingFrame label="Loading driver profile" />;
  if (!envelope) {
    return <CorePageState year={year} message={error?.message} onRetry={retry} />;
  }

  const { driver, teammate } = envelope.data;
  const sharedRounds = teammate
    ? driver.results.filter((result) => (
      teammate.results.some((candidate) => (
        candidate.round === result.round && candidate.team === result.team
      ))
    ))
    : [];
  const teammateShared = teammate
    ? new Map(teammate.results.map((result) => [result.round, result]))
    : new Map<number, DriverRoundResult>();
  const teammateRaceWins = sharedRounds.filter((result) => {
    const other = teammateShared.get(result.round);
    return result.position && other?.position && result.position < other.position;
  }).length;
  const teammateQualiWins = sharedRounds.filter((result) => {
    const other = teammateShared.get(result.round);
    return result.qualifying && other?.qualifying && result.qualifying < other.qualifying;
  }).length;
  const maxRoundPoints = Math.max(
    1,
    ...driver.results.map((result) => result.points + result.sprintPoints),
  );

  return (
    <main className="core-page analysis-page">
      <CorePageHeader
        eyebrow={`Season ${year} / driver profile`}
        title={driver.name}
        description={`${driver.team ?? 'Team unavailable'} · Championship P${driver.rank} · ${driver.points} points through round ${envelope.data.throughRound}.`}
        meta={envelope.meta}
        actions={(
          <Link className="core-page__switch" to={`/${year}/drivers`}>
            <ArrowLeft aria-hidden="true" size={15} />
            Driver directory
          </Link>
        )}
      />

      <section
        className="driver-profile__signature"
        style={{ '--team-color': getTeamColor(driver.team) } as CSSProperties}
      >
        <span className="driver-profile__number">{String(driver.rank).padStart(2, '0')}</span>
        <DriverMark driver={driver.name} size="lg" team={driver.team} year={year} />
        <TeamLogo size="lg" team={driver.team} tone="team" year={year} />
        <div>
          <span className="core-page__eyebrow">Championship signature</span>
          <h2>{driver.code ?? driver.name}</h2>
          <p>{driver.starts} starts · {driver.wins} wins · {driver.podiums} podiums</p>
        </div>
      </section>

      <MetricStrip
        label={`${driver.name} season summary`}
        items={[
          { label: 'Points / start', value: driver.pointsPerStart.toFixed(1), detail: `${driver.points} points`, definition: 'points-per-start' },
          { label: 'Average finish', value: formatAverage(driver.averageFinish), detail: `${driver.starts} starts`, definition: 'average-finish' },
          { label: 'Average qualifying', value: formatAverage(driver.averageQualifying), detail: 'Classified sessions', definition: 'average-qualifying' },
          { label: 'Reliability', value: `${Math.round(driver.reliability * 100)}%`, detail: `${driver.dnfs} non-finishes`, definition: 'reliability' },
        ]}
      />

      <section className="driver-profile__grid">
        <article className="analysis-panel driver-form-panel">
          <header className="analysis-panel__header">
            <div>
              <span className="core-page__eyebrow">Recent form</span>
              <h2>Last five classified races</h2>
            </div>
            <DefinitionLink definition="recent-form" />
          </header>
          <div className="driver-form-strip">
            {driver.recentForm.map((result) => (
              <Link
                key={result.round}
                to={`/${year}/races/${result.round}`}
                style={{ '--form-height': `${Math.max(12, ((result.points + result.sprintPoints) / maxRoundPoints) * 100)}%` } as CSSProperties}
              >
                <span className="driver-form-strip__bar" />
                <strong>{formatPosition(result.position)}</strong>
                <small>R{result.round}</small>
              </Link>
            ))}
          </div>
          <p className="analysis-summary">
            {driver.recentForm.reduce((sum, result) => sum + result.points + result.sprintPoints, 0)} points
            across the current five-race form window.
          </p>
        </article>

        <article className="analysis-panel driver-extremes">
          <header className="analysis-panel__header">
            <div>
              <span className="core-page__eyebrow">Season range</span>
              <h2>Best and hardest rounds</h2>
            </div>
            <Flag aria-hidden="true" size={20} />
          </header>
          <div>
            <Link to={`/${year}/races/${driver.bestResult?.round ?? 1}`}>
              <Trophy aria-hidden="true" size={18} />
              <span>
                <small>Best result</small>
                <strong>{formatPosition(driver.bestResult?.position ?? null)} · {driver.bestResult?.grandPrix ?? '—'}</strong>
              </span>
              <ArrowUpRight aria-hidden="true" size={15} />
            </Link>
            <Link to={`/${year}/races/${driver.worstResult?.round ?? 1}`}>
              <Flag aria-hidden="true" size={18} />
              <span>
                <small>Lowest classification</small>
                <strong>{formatPosition(driver.worstResult?.position ?? null)} · {driver.worstResult?.grandPrix ?? '—'}</strong>
              </span>
              <ArrowUpRight aria-hidden="true" size={15} />
            </Link>
          </div>
        </article>
      </section>

      {teammate && (
        <section className="analysis-panel teammate-panel">
          <header className="analysis-panel__header">
            <div>
              <span className="core-page__eyebrow">Shared-team sample</span>
              <h2>Against {teammate.name}</h2>
            </div>
            <Link to={`/${year}/compare?a=${driver.id}&b=${teammate.id}`}>
              Open full comparison
              <ArrowUpRight aria-hidden="true" size={15} />
            </Link>
          </header>
          <div className="teammate-comparison">
            <DriverIdentity name={driver.name} code={driver.code} team={driver.team} year={year} />
            <div>
              <span><small>Race H2H</small><strong>{teammateRaceWins}–{sharedRounds.length - teammateRaceWins}</strong></span>
              <span><small>Qualifying H2H</small><strong>{teammateQualiWins}–{sharedRounds.length - teammateQualiWins}</strong></span>
              <span><small>Shared rounds</small><strong>{sharedRounds.length}</strong></span>
            </div>
            <DriverIdentity name={teammate.name} code={teammate.code} team={teammate.team} year={year} />
          </div>
        </section>
      )}

      <section className="analysis-panel driver-evidence">
        <header className="analysis-panel__header">
          <div>
            <span className="core-page__eyebrow">Linked evidence</span>
            <h2>Every round in the profile</h2>
          </div>
          <span>{driver.results.length} records</span>
        </header>
        <ResponsiveDataView
          rows={[...driver.results].reverse()}
          columns={evidenceColumns}
          getKey={(result) => String(result.round)}
          label={`${driver.name} race evidence`}
        />
      </section>
    </main>
  );
};

export default DriverProfile;
