import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from 'react';
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  Tooltip,
  type ChartData,
  type ChartOptions,
  type ScatterDataPoint,
} from 'chart.js';
import { Scatter } from 'react-chartjs-2';
import {
  Activity,
  Database,
  Timer,
  Wrench,
} from 'lucide-react';
import { useParams, useSearchParams } from 'react-router-dom';
import { CorePageHeader } from '../components/CorePageHeader';
import { CorePageState } from '../components/CorePageState';
import { DriverIdentity } from '../components/DriverIdentity';
import TeamLogo from '../components/TeamLogo.jsx';
import type {
  PitRanking,
  PitStopRecord,
} from '../data/analysisData';
import { useAnalysisData } from '../hooks/useAnalysisData';
import { FilterBar, FilterField, SegmentedControl } from '../ui/AnalysisControls';
import { DefinitionLink } from '../ui/DefinitionLink';
import { LoadingFrame } from '../ui/LoadingFrame';
import { MetricStrip } from '../ui/MetricStrip';
import { ResponsiveDataView, type DataColumn } from '../ui/ResponsiveDataView';
import { getTeamColor } from '../utils/dataProcessing.js';
import {
  aggregatePitStops,
  summarizePitStopCoverage,
} from '../utils/pitStopAnalysis.js';
import { getSeasonFromParam } from '../utils/seasons.js';
import './AnalysisPages.css';

type EntityMode = 'team' | 'driver';
type PitMetric = 'service' | 'lane' | 'transit';
type PitScatterPoint = ScatterDataPoint & { record: PitStopRecord };

ChartJS.register(LinearScale, PointElement, Tooltip);

const metricField: Record<PitMetric, keyof PitRanking> = {
  service: 'serviceMedian',
  lane: 'pitLaneMedian',
  transit: 'transitMedian',
};

const metricDefinition: Record<PitMetric, string> = {
  service: 'pit-service-time',
  lane: 'pit-lane-time',
  transit: 'pit-transit-time',
};

const formatSeconds = (value: number | null | undefined, digits = 2) => (
  Number.isFinite(value) ? `${Number(value).toFixed(digits)}s` : '—'
);

const PitLaneWorkspace = () => {
  const { seasonYear } = useParams();
  const year = getSeasonFromParam(seasonYear);
  const [searchParams, setSearchParams] = useSearchParams();
  const { envelope, status, error, retry } = useAnalysisData(year, 'pit-lane');
  const linkedRound = searchParams.get('round');
  const [round, setRound] = useState(linkedRound ?? 'all');
  const [entityMode, setEntityMode] = useState<EntityMode>('team');
  const [metric, setMetric] = useState<PitMetric>('lane');
  const [selectedStopId, setSelectedStopId] = useState<string | null>(
    searchParams.get('pitStop'),
  );

  useEffect(() => {
    if (linkedRound) setRound(linkedRound);
  }, [linkedRound]);

  const filteredRecords = useMemo(() => (
    (envelope?.data.records ?? []).filter((record) => (
      round === 'all' || record.round === Number(round)
    ))
  ), [envelope, round]);
  const rankings = useMemo(() => (
    aggregatePitStops(filteredRecords, entityMode) as PitRanking[]
  ).filter((ranking) => Number.isFinite(ranking[metricField[metric]] as number))
    .sort((left, right) => (
      Number(left[metricField[metric]]) - Number(right[metricField[metric]])
    )), [entityMode, filteredRecords, metric]);
  const coverage = useMemo(() => (
    summarizePitStopCoverage(filteredRecords) as {
      records: number;
      serviceStops: number;
      pitLaneStops: number;
      matchedStops: number;
      fastestService: PitStopRecord | null;
      quickestPitLane: PitStopRecord | null;
      bestTransitDelta: PitStopRecord | null;
    }
  ), [filteredRecords]);

  const distribution = useMemo(() => {
    const field = metric === 'service'
      ? 'serviceTime'
      : metric === 'lane'
        ? 'pitLaneTime'
        : 'transitTime';
    const values = filteredRecords
      .map((record) => record[field])
      .filter((value): value is number => Number.isFinite(value));
    if (!values.length) return [];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = Math.max(0.001, max - min);
    const buckets = Array.from({ length: 6 }, (_, index) => ({
      from: min + ((span / 6) * index),
      to: min + ((span / 6) * (index + 1)),
      count: 0,
    }));
    values.forEach((value) => {
      const index = Math.min(5, Math.floor(((value - min) / span) * 6));
      buckets[index].count += 1;
    });
    return buckets;
  }, [filteredRecords, metric]);
  const matchedRecords = useMemo(() => (
    filteredRecords.filter((record) => (
      record.hasBreakdown
      && Number.isFinite(record.serviceTime)
      && Number.isFinite(record.pitLaneTime)
    ))
  ), [filteredRecords]);
  const linkedStop = useMemo(() => {
    const pitStopId = searchParams.get('pitStop');
    if (pitStopId) {
      const exact = filteredRecords.find((record) => record.id === pitStopId);
      if (exact) return exact;
    }

    const driver = searchParams.get('driver')?.toUpperCase();
    const lap = Number(searchParams.get('lap'));
    if (!driver || !Number.isFinite(lap)) return null;
    return filteredRecords.find((record) => (
      record.driverCode?.toUpperCase() === driver
      && record.lap === lap
    )) ?? null;
  }, [filteredRecords, searchParams]);
  const activeStopId = selectedStopId ?? linkedStop?.id ?? null;
  const selectedStop = activeStopId
    ? filteredRecords.find((record) => record.id === activeStopId) ?? null
    : null;

  const selectStop = (record: PitStopRecord) => {
    setSelectedStopId(record.id);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set('round', String(record.round));
      next.set('pitStop', record.id);
      if (record.driverCode) next.set('driver', record.driverCode);
      if (Number.isFinite(record.lap)) next.set('lap', String(record.lap));
      return next;
    }, { replace: true });
  };

  const scatterData = useMemo<ChartData<'scatter', PitScatterPoint[]>>(() => ({
    datasets: [{
      label: 'Individual pit stops',
      data: matchedRecords.map((record) => ({
        x: Number(record.serviceTime),
        y: Number(record.pitLaneTime),
        record,
      })),
      backgroundColor: matchedRecords.map((record) => getTeamColor(record.team)),
      borderColor: matchedRecords.map((record) => (
        record.id === activeStopId
          ? '#ffffff'
          : record.isAnomaly
            ? '#e35d5d'
            : '#11151b'
      )),
      borderWidth: matchedRecords.map((record) => (
        record.id === activeStopId ? 3 : record.isAnomaly ? 2 : 1
      )),
      pointRadius: matchedRecords.map((record) => record.isAnomaly ? 7 : 5),
      pointHoverRadius: 9,
    }],
  }), [activeStopId, matchedRecords]);

  const scatterOptions = useMemo<ChartOptions<'scatter'>>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      intersect: true,
      mode: 'nearest',
    },
    onClick: (_event, elements) => {
      const index = elements[0]?.index;
      if (index === undefined) return;
      selectStop(matchedRecords[index]);
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#101318',
        borderColor: '#353b46',
        borderWidth: 1,
        titleColor: '#ffffff',
        bodyColor: '#d5dae2',
        padding: 10,
        callbacks: {
          title: (items) => {
            const point = items[0]?.raw as PitScatterPoint | undefined;
            return point?.record.driver ?? point?.record.driverCode ?? 'Pit stop';
          },
          label: (context) => {
            const point = context.raw as PitScatterPoint;
            const record = point.record;
            return [
              `Team: ${record.team ?? 'Unknown'}`,
              `Race: ${record.grandPrix ?? `Round ${record.round}`} · Lap ${record.lap ?? '—'}`,
              `Service: ${formatSeconds(record.serviceTime)}`,
              `Pit lane: ${formatSeconds(record.pitLaneTime)}`,
              `Transit: ${formatSeconds(record.transitTime)}`,
              `Anomaly score: ${Number(record.anomalyScore ?? 0).toFixed(2)}`,
              `Explanation: ${record.explanationStatus ?? 'unexplained'}`,
            ];
          },
          footer: (items) => {
            const point = items[0]?.raw as PitScatterPoint | undefined;
            return point?.record.isAnomaly ? 'Click to inspect supporting evidence' : '';
          },
        },
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.07)' },
        ticks: { color: '#929aa8', callback: (value) => `${value}s` },
        title: {
          display: true,
          text: 'Stationary service time',
          color: '#aeb5c0',
        },
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.07)' },
        ticks: { color: '#929aa8', callback: (value) => `${value}s` },
        title: {
          display: true,
          text: 'Full pit-lane time',
          color: '#aeb5c0',
        },
      },
    },
  }), [matchedRecords]);

  const columns = useMemo<Array<DataColumn<PitRanking>>>(() => [
    {
      id: 'entity',
      header: entityMode === 'team' ? 'Team' : 'Driver',
      render: (ranking) => (
        entityMode === 'team'
          ? (
            <span className="pit-entity">
              <TeamLogo size="xs" team={ranking.entity} tone="team" year={year} />
              <strong>{ranking.entity}</strong>
            </span>
          )
          : (
            <DriverIdentity
              name={ranking.entity}
              team={ranking.team}
              year={year}
            />
          )
      ),
    },
    {
      id: 'service',
      header: 'Service median',
      align: 'right',
      render: (ranking) => formatSeconds(ranking.serviceMedian),
    },
    {
      id: 'lane',
      header: 'Lane median',
      align: 'right',
      render: (ranking) => formatSeconds(ranking.pitLaneMedian),
    },
    {
      id: 'transit',
      header: 'Transit median',
      align: 'right',
      render: (ranking) => formatSeconds(ranking.transitMedian),
    },
    {
      id: 'coverage',
      header: 'Matched',
      align: 'right',
      render: (ranking) => `${ranking.matchedStops}/${ranking.stops}`,
    },
  ], [entityMode, year]);

  if (!envelope && status === 'loading') return <LoadingFrame label="Loading Pit Lane" />;
  if (!envelope) {
    return <CorePageState year={year} message={error?.message} onRetry={retry} />;
  }

  const metricLabel = {
    service: 'Stationary service',
    lane: 'Full pit lane',
    transit: 'Lane transit',
  }[metric];
  const fastest = rankings[0];
  const maxBucket = Math.max(1, ...distribution.map((bucket) => bucket.count));

  return (
    <main className="core-page analysis-page">
      <CorePageHeader
        eyebrow={`Season ${year} / through round ${envelope.data.throughRound}`}
        title="Pit Lane"
        description="Separate stationary crew service, total pit-lane loss, and lane transit before comparing teams or drivers."
        meta={envelope.meta}
      />

      <MetricStrip
        label={`${year} pit-lane coverage`}
        items={[
          { label: 'Recorded stops', value: coverage.records, detail: round === 'all' ? 'Season sample' : `Round ${round}` },
          { label: 'Service clocks', value: coverage.serviceStops, detail: 'DHL / published service data', definition: 'pit-service-time' },
          { label: 'Lane clocks', value: coverage.pitLaneStops, detail: 'Formula1.com summary', definition: 'pit-lane-time' },
          { label: 'Matched stops', value: coverage.matchedStops, detail: 'Both clocks available', definition: 'pit-clock-matching' },
        ]}
      />

      <FilterBar title="Choose the pit sample">
        <FilterField label="Race">
          <select
            value={round}
            onChange={(event) => {
              setRound(event.target.value);
              setSelectedStopId(null);
              setSearchParams((current) => {
                const next = new URLSearchParams(current);
                ['pitStop', 'driver', 'lap'].forEach((key) => next.delete(key));
                if (event.target.value === 'all') next.delete('round');
                else next.set('round', event.target.value);
                return next;
              }, { replace: true });
            }}
          >
            <option value="all">All available rounds</option>
            {envelope.data.races.map((race) => (
              <option key={race.round} value={race.round}>R{race.round} · {race.grandPrix}</option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Ranking entity">
          <SegmentedControl
            label="Ranking entity"
            value={entityMode}
            options={[
              { value: 'team', label: 'Teams' },
              { value: 'driver', label: 'Drivers' },
            ]}
            onChange={setEntityMode}
          />
        </FilterField>
        <FilterField className="is-wide" label="Timing measure">
          <SegmentedControl
            label="Pit timing measure"
            value={metric}
            options={[
              { value: 'service', label: 'Service' },
              { value: 'lane', label: 'Full lane' },
              { value: 'transit', label: 'Transit' },
            ]}
            onChange={setMetric}
          />
        </FilterField>
      </FilterBar>

      <section className="pit-distribution-grid">
        <article className="analysis-panel pit-distribution">
          <header className="analysis-panel__header">
            <div>
              <span className="core-page__eyebrow">Field distribution first</span>
              <h2>{metricLabel} spread</h2>
            </div>
            <DefinitionLink definition="pit-time-distribution" />
          </header>
          {distribution.length ? (
            <div className="pit-histogram" aria-label={`${metricLabel} timing distribution`}>
              {distribution.map((bucket) => (
                <div key={bucket.from}>
                  <span style={{ height: `${(bucket.count / maxBucket) * 100}%` }} />
                  <strong>{bucket.count}</strong>
                  <small>{bucket.from.toFixed(1)}–{bucket.to.toFixed(1)}s</small>
                </div>
              ))}
            </div>
          ) : (
            <p className="analysis-empty">This timing measure is unavailable for the selected race.</p>
          )}
        </article>

        <aside className="analysis-panel pit-leader">
          <header className="analysis-panel__header">
            <div>
              <span className="core-page__eyebrow">Fastest median</span>
              <h2>{fastest?.entity ?? 'No ranking'}</h2>
            </div>
            <Timer aria-hidden="true" size={20} />
          </header>
          <strong>{fastest ? formatSeconds(fastest[metricField[metric]] as number | null) : '—'}</strong>
          <p>{fastest?.stops ?? 0} recorded stops in this sample.</p>
          <DefinitionLink definition={metricDefinition[metric]} />
        </aside>
      </section>

      <section className="analysis-panel pit-scatter-panel" id="pit-stop-scatter">
        <header className="analysis-panel__header">
          <div>
            <span className="core-page__eyebrow">Individual matched stops</span>
            <h2>Crew speed versus total lane time</h2>
          </div>
          <span>{matchedRecords.length} points</span>
        </header>
        <p className="analysis-summary">
          Each point is one matched stop. Low and left is quick on both clocks;
          outlined points are statistical outliers. Select a point to inspect its evidence.
        </p>
        {matchedRecords.length ? (
          <div className="pit-scatter-chart">
            <Scatter
              data={scatterData}
              options={scatterOptions}
              aria-label="Pit-stop service time versus total lane time scatter plot"
              role="img"
            />
          </div>
        ) : (
          <p className="analysis-empty">Matched service and pit-lane clocks are required for this plot.</p>
        )}

        {selectedStop && (
          <article
            className="pit-stop-evidence"
            aria-live="polite"
            style={{ '--team-color': getTeamColor(selectedStop.team) } as CSSProperties}
          >
            <header>
              <div>
                <span className="core-page__eyebrow">
                  {selectedStop.grandPrix ?? `Round ${selectedStop.round}`} · lap {selectedStop.lap ?? '—'}
                </span>
                <h3>{selectedStop.driver ?? selectedStop.driverCode ?? 'Selected stop'}</h3>
                <small>{selectedStop.team ?? 'Team unavailable'}</small>
              </div>
              <span className={`pit-anomaly-status is-${selectedStop.explanationStatus ?? 'unexplained'}`}>
                {selectedStop.isAnomaly ? selectedStop.anomalyLabel : 'Within distribution'}
              </span>
            </header>
            <div className="pit-stop-evidence__metrics">
              <div>
                <span>Service</span>
                <strong>{formatSeconds(selectedStop.serviceTime)}</strong>
                <small>Expected {formatSeconds(selectedStop.expectedServiceTime)}</small>
              </div>
              <div>
                <span>Full lane</span>
                <strong>{formatSeconds(selectedStop.pitLaneTime)}</strong>
                <small>Expected {formatSeconds(selectedStop.expectedPitLaneTime)}</small>
              </div>
              <div>
                <span>Transit</span>
                <strong>{formatSeconds(selectedStop.transitTime)}</strong>
                <small>Expected {formatSeconds(selectedStop.expectedTransitTime)}</small>
              </div>
              <div>
                <span>Anomaly score</span>
                <strong>{Number(selectedStop.anomalyScore ?? 0).toFixed(2)}</strong>
                <small>{selectedStop.explanationStatus ?? 'unexplained'}</small>
              </div>
            </div>
            <p>{selectedStop.explanation}</p>
            <ul>
              {(selectedStop.evidence ?? []).map((evidence, index) => (
                <li key={`${evidence.kind}-${evidence.eventId ?? evidence.source}-${index}`}>
                  <strong>{evidence.kind.replaceAll('_', ' ')}</strong>
                  <span>{evidence.message ?? evidence.source ?? 'Source record'}</span>
                </li>
              ))}
            </ul>
          </article>
        )}
      </section>

      <section className="analysis-panel pit-rankings">
        <header className="analysis-panel__header">
          <div>
            <span className="core-page__eyebrow">{metricLabel}</span>
            <h2>{entityMode === 'team' ? 'Team' : 'Driver'} timing order</h2>
          </div>
          <span>{rankings.length} ranked</span>
        </header>
        <ResponsiveDataView
          rows={rankings}
          columns={columns}
          getKey={(ranking) => ranking.entity}
          label={`${metricLabel} ${entityMode} rankings`}
          emptyMessage="No entities have the selected timing measure."
        />
      </section>

      <section className="pit-clock-notes">
        <article>
          <Wrench aria-hidden="true" size={19} />
          <h3>Stationary service</h3>
          <p>The time the car is being serviced in its pit box. Source labels remain attached to every matched stop.</p>
          <DefinitionLink definition="pit-service-time" />
        </article>
        <article>
          <Activity aria-hidden="true" size={19} />
          <h3>Full pit lane</h3>
          <p>The complete pit-lane duration reported in the official pit-stop summary, including travel and service.</p>
          <DefinitionLink definition="pit-lane-time" />
        </article>
        <article>
          <Database aria-hidden="true" size={19} />
          <h3>Matched transit</h3>
          <p>Full lane time minus service time only when driver and lap records can be matched safely.</p>
          <DefinitionLink definition="pit-transit-time" />
        </article>
      </section>

      <aside className="analysis-source-note">
        <Database aria-hidden="true" size={16} />
        <p>
          Pit-lane duration and stationary service come from different clocks.
          They are never substituted for one another when a match is unavailable.
        </p>
        <DefinitionLink definition="pit-source-authority" children="Read source authority" />
      </aside>
    </main>
  );
};

export default PitLaneWorkspace;
