import { useMemo, type CSSProperties } from 'react';
import {
  ArrowLeftRight,
  ArrowUpRight,
  Link2,
} from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { CorePageHeader } from '../components/CorePageHeader';
import { CorePageState } from '../components/CorePageState';
import { DriverIdentity } from '../components/DriverIdentity';
import type {
  AnalysisDriver,
  DriverRoundResult,
} from '../data/analysisData';
import { useAnalysisData } from '../hooks/useAnalysisData';
import { FilterBar, FilterField } from '../ui/AnalysisControls';
import { DefinitionLink } from '../ui/DefinitionLink';
import { LoadingFrame } from '../ui/LoadingFrame';
import { ResponsiveDataView, type DataColumn } from '../ui/ResponsiveDataView';
import { getTeamColor } from '../utils/dataProcessing.js';
import { getSeasonFromParam } from '../utils/seasons.js';
import './AnalysisPages.css';

interface SharedRound {
  round: number;
  grandPrix: string;
  left: DriverRoundResult;
  right: DriverRoundResult;
}

const average = (value: number | null) => value === null ? '—' : value.toFixed(1);
const position = (value: number | null) => value ? `P${value}` : 'NC';

const headToHead = (
  rounds: SharedRound[],
  field: 'position' | 'qualifying' | 'sprintPosition',
) => rounds.reduce((score, round) => {
  const left = round.left[field];
  const right = round.right[field];
  if (!left || !right || left === right) return score;
  if (left < right) score.left += 1;
  else score.right += 1;
  return score;
}, { left: 0, right: 0 });

const metricWinner = (
  left: number | null,
  right: number | null,
  lowerBetter = false,
) => {
  if (left === null || right === null || left === right) return 'level';
  return (lowerBetter ? left < right : left > right) ? 'left' : 'right';
};

const CompareWorkspace = () => {
  const { seasonYear } = useParams();
  const year = getSeasonFromParam(seasonYear);
  const [searchParams, setSearchParams] = useSearchParams();
  const { envelope, status, error, retry } = useAnalysisData(year, 'compare');

  const drivers = envelope?.data.drivers ?? [];
  const requestedLeft = searchParams.get('a');
  const requestedRight = searchParams.get('b');
  const left = drivers.find((driver) => driver.id === requestedLeft) ?? drivers[0];
  const right = drivers.find((driver) => driver.id === requestedRight && driver.id !== left?.id)
    ?? drivers.find((driver) => driver.id !== left?.id);

  const sharedRounds = useMemo<SharedRound[]>(() => {
    if (!left || !right) return [];
    const rightByRound = new Map(right.results.map((result) => [result.round, result]));
    return left.results.flatMap((leftResult) => {
      const rightResult = rightByRound.get(leftResult.round);
      return rightResult
        ? [{
          round: leftResult.round,
          grandPrix: leftResult.grandPrix,
          left: leftResult,
          right: rightResult,
        }]
        : [];
    });
  }, [left, right]);

  const columns = useMemo<Array<DataColumn<SharedRound>>>(() => (
    left && right ? [
      {
        id: 'race',
        header: 'Shared round',
        render: (round) => (
          <Link className="analysis-table-link" to={`/${year}/races/${round.round}`}>
            <strong>R{round.round} · {round.grandPrix}</strong>
            <small>Open race evidence</small>
          </Link>
        ),
      },
      {
        id: 'left-quali',
        header: `${left.code ?? left.name} quali`,
        align: 'center',
        render: (round) => position(round.left.qualifying),
      },
      {
        id: 'right-quali',
        header: `${right.code ?? right.name} quali`,
        align: 'center',
        render: (round) => position(round.right.qualifying),
      },
      {
        id: 'left-finish',
        header: `${left.code ?? left.name} finish`,
        align: 'center',
        render: (round) => position(round.left.position),
      },
      {
        id: 'right-finish',
        header: `${right.code ?? right.name} finish`,
        align: 'center',
        render: (round) => position(round.right.position),
      },
      {
        id: 'points',
        header: 'Points',
        align: 'right',
        render: (round) => `${round.left.points + round.left.sprintPoints}–${round.right.points + round.right.sprintPoints}`,
      },
    ] : []
  ), [left, right, year]);

  if (!envelope && status === 'loading') return <LoadingFrame label="Loading comparison workspace" />;
  if (!envelope || !left || !right) {
    return <CorePageState year={year} message={error?.message} onRetry={retry} />;
  }

  const updateDriver = (slot: 'a' | 'b', id: string) => {
    const next = new URLSearchParams(searchParams);
    next.set(slot, id);
    if (next.get('a') === next.get('b')) {
      const alternative = drivers.find((driver) => driver.id !== id);
      next.set(slot === 'a' ? 'b' : 'a', alternative?.id ?? '');
    }
    setSearchParams(next, { replace: true });
  };
  const swap = () => {
    setSearchParams({ a: right.id, b: left.id }, { replace: true });
  };

  const raceH2H = headToHead(sharedRounds, 'position');
  const qualifyingH2H = headToHead(sharedRounds, 'qualifying');
  const sprintH2H = headToHead(sharedRounds, 'sprintPosition');
  const pointGap = Math.abs(left.points - right.points);
  const pointLeader = left.points === right.points ? null : left.points > right.points ? left : right;
  const metricRows = [
    { label: 'Championship points', left: left.points, right: right.points, definition: 'championship-points' },
    { label: 'Wins', left: left.wins, right: right.wins, definition: 'race-wins' },
    { label: 'Podiums', left: left.podiums, right: right.podiums, definition: 'podiums' },
    { label: 'Average qualifying', left: left.averageQualifying, right: right.averageQualifying, lowerBetter: true, definition: 'average-qualifying' },
    { label: 'Average finish', left: left.averageFinish, right: right.averageFinish, lowerBetter: true, definition: 'average-finish' },
    { label: 'Reliability', left: left.reliability * 100, right: right.reliability * 100, suffix: '%', definition: 'reliability' },
    { label: 'Points / start', left: left.pointsPerStart, right: right.pointsPerStart, definition: 'points-per-start' },
  ];
  const compareColors = {
    '--compare-left': getTeamColor(left.team),
    '--compare-right': getTeamColor(right.team),
  } as CSSProperties;

  return (
    <main className="core-page analysis-page">
      <CorePageHeader
        eyebrow={`Season ${year} / ${sharedRounds.length} shared rounds`}
        title="Compare"
        description="A factual driver comparison with one shared sample, visible missing-data context, and a URL that preserves both selections."
        meta={envelope.meta}
      />

      <FilterBar
        title="Choose two drivers"
        actions={(
          <button className="analysis-action-button" type="button" onClick={swap}>
            <ArrowLeftRight aria-hidden="true" size={15} />
            Swap
          </button>
        )}
      >
        <FilterField label="Driver A">
          <select value={left.id} onChange={(event) => updateDriver('a', event.target.value)}>
            {drivers.map((driver) => (
              <option key={driver.id} value={driver.id}>{driver.name} · {driver.team}</option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Driver B">
          <select value={right.id} onChange={(event) => updateDriver('b', event.target.value)}>
            {drivers.map((driver) => (
              <option key={driver.id} value={driver.id}>{driver.name} · {driver.team}</option>
            ))}
          </select>
        </FilterField>
      </FilterBar>

      <section className="compare-verdict" style={compareColors}>
        <div className="compare-verdict__driver is-left">
          <span className="compare-verdict__slot">Driver A</span>
          <DriverIdentity name={left.name} code={left.code} team={left.team} year={year} size="lg" />
          <small>{left.points} pts · {left.wins} wins · {left.podiums} podiums</small>
        </div>
        <div className="compare-verdict__delta">
          <span className="core-page__eyebrow">Current factual delta</span>
          <strong>{pointGap} points</strong>
          <p>
            {pointLeader
              ? `${pointLeader.name} leads the championship comparison.`
              : 'The drivers are level on championship points.'}
          </p>
          <span><Link2 aria-hidden="true" size={13} /> Shareable selection is encoded in this URL.</span>
        </div>
        <div className="compare-verdict__driver is-right">
          <span className="compare-verdict__slot">Driver B</span>
          <DriverIdentity name={right.name} code={right.code} team={right.team} year={year} size="lg" />
          <small>{right.points} pts · {right.wins} wins · {right.podiums} podiums</small>
        </div>
      </section>

      <section className="compare-head-to-head">
        {[
          ['Race H2H', raceH2H, 'race-head-to-head'],
          ['Qualifying H2H', qualifyingH2H, 'qualifying-head-to-head'],
          ['Sprint H2H', sprintH2H, 'sprint-head-to-head'],
        ].map(([label, score, definition]) => {
          const typedScore = score as { left: number; right: number };
          const scored = typedScore.left + typedScore.right;
          const leftShare = scored ? (typedScore.left / scored) * 100 : 50;
          return (
            <article
              key={label as string}
              style={{ '--left-share': `${leftShare}%` } as CSSProperties}
            >
              <small>{label as string}</small>
              <strong>{typedScore.left}<i>–</i>{typedScore.right}</strong>
              <span className="compare-head-to-head__drivers">
                <b>{left.code ?? 'A'}</b>
                <b>{right.code ?? 'B'}</b>
              </span>
              <span className="compare-head-to-head__bar" aria-hidden="true"><i /></span>
              <DefinitionLink definition={definition as string} />
            </article>
          );
        })}
      </section>

      <section className="analysis-panel compare-metrics">
        <header className="analysis-panel__header">
          <div>
            <span className="core-page__eyebrow">Season metrics</span>
            <h2>One metric row per comparison</h2>
          </div>
          <span>{left.code ?? 'A'} / {right.code ?? 'B'}</span>
        </header>
        <div className="compare-metric-list">
          {metricRows.map((metric) => {
            const leftValue = metric.left === null ? null : Number(metric.left);
            const rightValue = metric.right === null ? null : Number(metric.right);
            const winner = metricWinner(leftValue, rightValue, metric.lowerBetter);
            const format = (value: number | null) => (
              value === null ? '—' : `${Number.isInteger(value) ? value : value.toFixed(1)}${metric.suffix ?? ''}`
            );
            return (
              <div className={`winner-${winner}`} key={metric.label}>
                <strong className={winner === 'left' ? 'is-leading' : ''}>{format(leftValue)}</strong>
                <span>
                  {metric.label}
                  <DefinitionLink definition={metric.definition} />
                </span>
                <strong className={winner === 'right' ? 'is-leading' : ''}>{format(rightValue)}</strong>
              </div>
            );
          })}
        </div>
      </section>

      <section className="analysis-panel compare-evidence">
        <header className="analysis-panel__header">
          <div>
            <span className="core-page__eyebrow">Shared race sample</span>
            <h2>Round-by-round evidence</h2>
          </div>
          <Link to={`/${year}/results`}>
            Open full results
            <ArrowUpRight aria-hidden="true" size={15} />
          </Link>
        </header>
        <p className="analysis-summary">
          Only rounds containing a result for both selected drivers are included.
          Missing sessions are excluded rather than scored as losses.
        </p>
        <ResponsiveDataView
          rows={[...sharedRounds].reverse()}
          columns={columns}
          getKey={(round) => String(round.round)}
          label={`${left.name} and ${right.name} shared results`}
        />
      </section>
    </main>
  );
};

export default CompareWorkspace;
