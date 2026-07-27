import { useMemo, useState, type CSSProperties } from 'react';
import {
  Activity,
  Database,
  Timer,
  Wrench,
} from 'lucide-react';
import { useParams } from 'react-router-dom';
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
  const { envelope, status, error, retry } = useAnalysisData(year, 'pit-lane');
  const [round, setRound] = useState('all');
  const [entityMode, setEntityMode] = useState<EntityMode>('team');
  const [metric, setMetric] = useState<PitMetric>('lane');

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
          <select value={round} onChange={(event) => setRound(event.target.value)}>
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
