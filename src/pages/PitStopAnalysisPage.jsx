import React, { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Bar, Line, Scatter } from 'react-chartjs-2';
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';
import {
  Activity,
  CheckCircle2,
  Database,
  Gauge,
  RefreshCw,
  Route,
  Timer,
  Users,
  Wrench,
} from 'lucide-react';
import { F1PageLayout } from '../components/ChartComponents.jsx';
import TeamLogo from '../components/TeamLogo.jsx';
import driverPitStopData from '../data/Driver_Pitstop.json';
import pitStopTiming2025 from '../data/pitStopTiming2025.json';
import pitStopTiming2026 from '../data/pitStopTiming2026.json';
import { useSeasonData } from '../hooks/useSeasonData.js';
import { getTeamColor } from '../utils/dataProcessing.js';
import {
  aggregatePitStops,
  buildPitStopRecords,
  median,
  summarizePitStopCoverage,
} from '../utils/pitStopAnalysis.js';
import { getSeasonFromParam } from '../utils/seasons.js';
import './PitStopAnalysisPage.css';

ChartJS.register(
  BarElement,
  CategoryScale,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
);

const formatSeconds = (value, digits = 2) => (
  Number.isFinite(value) ? `${value.toFixed(digits)}s` : '—'
);

const formatSignedSeconds = (value) => {
  if (!Number.isFinite(value)) return '—';
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}s`;
};

const timingFallbacks = new Map([
  [2025, pitStopTiming2025],
  [2026, pitStopTiming2026],
]);

const getDisplayRaces = (races, selectedYear) => {
  const fallbackRaces = timingFallbacks.get(Number(selectedYear))?.races ?? [];
  const raceByRound = new Map(
    fallbackRaces.map((race) => [Number(race.round), race]),
  );

  (races ?? []).forEach((race) => {
    const fallback = raceByRound.get(Number(race.round));
    raceByRound.set(Number(race.round), {
      ...fallback,
      ...race,
      pit_stops: race.pit_stops?.length ? race.pit_stops : fallback?.pit_stops ?? [],
      dhl_pit_stops: race.dhl_pit_stops?.length
        ? race.dhl_pit_stops
        : fallback?.dhl_pit_stops ?? [],
      pit_stop_sources: race.pit_stop_sources ?? fallback?.pit_stop_sources,
    });
  });

  if (Number(selectedYear) === 2025) {
    driverPitStopData.forEach((race) => {
      if (!raceByRound.has(Number(race.round))) {
        raceByRound.set(Number(race.round), {
          round: Number(race.round),
          grand_prix: race.grand_prix,
          pit_stops: [],
        });
      }
    });
  }

  return Array.from(raceByRound.values()).sort((a, b) => a.round - b.round);
};

const getBaseChartOptions = (isMobile = false) => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: {
    intersect: false,
    mode: 'nearest',
  },
  plugins: {
    legend: {
      labels: {
        color: '#c8ced8',
        boxWidth: 12,
        font: { size: isMobile ? 10 : 12 },
      },
    },
    tooltip: {
      backgroundColor: '#101318',
      borderColor: '#353b46',
      borderWidth: 1,
      titleColor: '#ffffff',
      bodyColor: '#d5dae2',
      padding: 10,
    },
  },
  scales: {
    x: {
      grid: { color: 'rgba(255, 255, 255, 0.07)' },
      ticks: { color: '#929aa8' },
      title: { color: '#aeb5c0' },
    },
    y: {
      grid: { color: 'rgba(255, 255, 255, 0.07)' },
      ticks: { color: '#929aa8' },
      title: { color: '#aeb5c0' },
    },
  },
});

const MetricCard = ({ icon: _Icon, label, value, detail, tone = 'neutral' }) => (
  <article className={`pit-metric pit-metric--${tone}`}>
    <div className="pit-metric__label">
      <_Icon aria-hidden="true" size={17} />
      <span>{label}</span>
    </div>
    <strong>{value}</strong>
    <span className="pit-metric__detail">{detail}</span>
  </article>
);

const ChartPanel = ({ title, description, children, className = '' }) => (
  <section className={`pit-panel ${className}`}>
    <header className="pit-panel__header">
      <h2>{title}</h2>
      <p>{description}</p>
    </header>
    {children}
  </section>
);

const CoverageBar = ({ matched, total }) => {
  const percentage = total > 0 ? Math.round((matched / total) * 100) : 0;

  return (
    <div
      className="pit-coverage"
      aria-label={`${percentage}% of stops have both service and pit-lane timing`}
    >
      <span style={{ width: `${percentage}%` }} />
    </div>
  );
};

const PitStopAnalysisPage = () => {
  const { seasonYear } = useParams();
  const selectedYear = getSeasonFromParam(seasonYear);
  const { races, status, error, retry } = useSeasonData(selectedYear);
  const [analysisType, setAnalysisType] = useState('team');
  const [selectedRound, setSelectedRound] = useState('all');
  const [selectedEntity, setSelectedEntity] = useState('all');

  const displayRaces = useMemo(
    () => getDisplayRaces(races, selectedYear),
    [races, selectedYear],
  );
  const allRecords = useMemo(() => buildPitStopRecords(displayRaces, {
    legacyDhlData: selectedYear === 2025 ? driverPitStopData : [],
    seasonYear: selectedYear,
  }), [displayRaces, selectedYear]);
  const filteredRecords = useMemo(() => (
    selectedRound === 'all'
      ? allRecords
      : allRecords.filter((record) => record.round === Number(selectedRound))
  ), [allRecords, selectedRound]);
  const rankings = useMemo(
    () => aggregatePitStops(filteredRecords, analysisType),
    [analysisType, filteredRecords],
  );
  const coverage = useMemo(
    () => summarizePitStopCoverage(filteredRecords),
    [filteredRecords],
  );
  const availableRounds = useMemo(() => (
    displayRaces.filter((race) => allRecords.some((record) => record.round === race.round))
  ), [allRecords, displayRaces]);
  const entityOptions = useMemo(
    () => rankings.map((ranking) => ranking.entity),
    [rankings],
  );

  const breakdownRankings = rankings
    .filter((ranking) => Number.isFinite(ranking.transitMedian))
    .sort((a, b) => a.transitMedian - b.transitMedian);
  const breakdownData = {
    labels: breakdownRankings.map((ranking) => ranking.entity),
    datasets: [
      {
        label: 'Stationary service',
        data: breakdownRankings.map((ranking) => ranking.serviceMedian),
        backgroundColor: '#e0b533',
        borderWidth: 0,
      },
      {
        label: 'Pit-lane transit',
        data: breakdownRankings.map((ranking) => ranking.transitMedian),
        backgroundColor: '#4d8ed8',
        borderWidth: 0,
      },
    ],
  };
  const breakdownOptions = {
    ...getBaseChartOptions(),
    indexAxis: 'y',
    plugins: {
      ...getBaseChartOptions().plugins,
      tooltip: {
        ...getBaseChartOptions().plugins.tooltip,
        callbacks: {
          footer: (items) => {
            const index = items[0]?.dataIndex;
            const ranking = breakdownRankings[index];
            return ranking
              ? `Median total: ${formatSeconds(ranking.pitLaneMedian)}`
              : '';
          },
        },
      },
    },
    scales: {
      x: {
        stacked: true,
        beginAtZero: true,
        grid: { color: 'rgba(255, 255, 255, 0.07)' },
        ticks: { color: '#929aa8', callback: (value) => `${value}s` },
        title: { display: true, text: 'Median time', color: '#aeb5c0' },
      },
      y: {
        stacked: true,
        grid: { display: false },
        ticks: { color: '#c8ced8' },
      },
    },
  };

  const matchedRecords = filteredRecords.filter((record) => record.hasBreakdown);
  const scatterData = {
    datasets: [{
      label: 'Individual stops',
      data: matchedRecords.map((record) => ({
        x: record.serviceTime,
        y: record.pitLaneTime,
        record,
      })),
      backgroundColor: matchedRecords.map((record) => getTeamColor(record.team)),
      borderColor: '#f7f8fa',
      borderWidth: 1,
      pointRadius: 6,
      pointHoverRadius: 8,
    }],
  };
  const scatterOptions = {
    ...getBaseChartOptions(),
    plugins: {
      ...getBaseChartOptions().plugins,
      legend: { display: false },
      tooltip: {
        ...getBaseChartOptions().plugins.tooltip,
        callbacks: {
          title: (items) => items[0]?.raw?.record?.driver ?? '',
          label: (context) => {
            const record = context.raw.record;
            return [
              `${record.team} · ${record.grandPrix}`,
              `Service: ${formatSeconds(record.serviceTime)}`,
              `Pit lane: ${formatSeconds(record.pitLaneTime)}`,
              `Transit: ${formatSeconds(record.transitTime)}`,
            ];
          },
        },
      },
    },
    scales: {
      x: {
        beginAtZero: false,
        grid: { color: 'rgba(255, 255, 255, 0.07)' },
        ticks: { color: '#929aa8', callback: (value) => `${value}s` },
        title: { display: true, text: 'Stationary service time', color: '#aeb5c0' },
      },
      y: {
        beginAtZero: false,
        grid: { color: 'rgba(255, 255, 255, 0.07)' },
        ticks: { color: '#929aa8', callback: (value) => `${value}s` },
        title: { display: true, text: 'Full pit-lane time', color: '#aeb5c0' },
      },
    },
  };

  const deltaRankings = rankings
    .filter((ranking) => Number.isFinite(ranking.laneDeltaMedian))
    .sort((a, b) => a.laneDeltaMedian - b.laneDeltaMedian);
  const deltaData = {
    labels: deltaRankings.map((ranking) => ranking.entity),
    datasets: [{
      label: 'Median versus race field',
      data: deltaRankings.map((ranking) => ranking.laneDeltaMedian),
      backgroundColor: deltaRankings.map((ranking) => (
        ranking.laneDeltaMedian <= 0 ? '#3bbf8a' : '#e35d5d'
      )),
      borderWidth: 0,
    }],
  };
  const deltaOptions = {
    ...getBaseChartOptions(),
    indexAxis: 'y',
    plugins: {
      ...getBaseChartOptions().plugins,
      legend: { display: false },
      tooltip: {
        ...getBaseChartOptions().plugins.tooltip,
        callbacks: {
          label: (context) => `${formatSignedSeconds(context.raw)} versus race median`,
        },
      },
    },
    scales: {
      x: {
        grid: {
          color: (context) => (
            context.tick.value === 0
              ? 'rgba(255, 255, 255, 0.45)'
              : 'rgba(255, 255, 255, 0.07)'
          ),
        },
        ticks: { color: '#929aa8', callback: (value) => `${value > 0 ? '+' : ''}${value}s` },
        title: { display: true, text: 'Pit-lane time delta', color: '#aeb5c0' },
      },
      y: {
        grid: { display: false },
        ticks: { color: '#c8ced8' },
      },
    },
  };

  const trendRecords = selectedEntity === 'all'
    ? filteredRecords
    : filteredRecords.filter((record) => (
      analysisType === 'driver'
        ? record.driver === selectedEntity
        : record.team === selectedEntity
    ));
  const trendByRound = availableRounds.map((race) => {
    const roundRecords = trendRecords.filter((record) => record.round === race.round);
    return {
      label: `R${race.round}`,
      service: median(roundRecords.map((record) => record.serviceTime)),
      pitLane: median(roundRecords.map((record) => record.pitLaneTime)),
    };
  });
  const trendData = {
    labels: trendByRound.map((round) => round.label),
    datasets: [
      {
        label: 'Stationary service',
        data: trendByRound.map((round) => round.service),
        borderColor: '#e0b533',
        backgroundColor: '#e0b533',
        yAxisID: 'service',
        tension: 0.25,
        pointRadius: 4,
        spanGaps: true,
      },
      {
        label: 'Full pit lane',
        data: trendByRound.map((round) => round.pitLane),
        borderColor: '#4d8ed8',
        backgroundColor: '#4d8ed8',
        yAxisID: 'lane',
        tension: 0.25,
        pointRadius: 4,
        spanGaps: true,
      },
    ],
  };
  const trendOptions = {
    ...getBaseChartOptions(),
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.07)' },
        ticks: { color: '#929aa8' },
      },
      service: {
        position: 'left',
        grid: { color: 'rgba(255, 255, 255, 0.07)' },
        ticks: { color: '#e0b533', callback: (value) => `${value}s` },
        title: { display: true, text: 'Service time', color: '#e0b533' },
      },
      lane: {
        position: 'right',
        grid: { drawOnChartArea: false },
        ticks: { color: '#6ea8e8', callback: (value) => `${value}s` },
        title: { display: true, text: 'Pit-lane time', color: '#6ea8e8' },
      },
    },
  };

  const hasAnyData = allRecords.length > 0;
  const hasJoinedData = coverage.matchedStops > 0;

  return (
    <F1PageLayout
      title={`${selectedYear} Pit Stop Analysis`}
      subtitle="Crew service, pit-lane transit, and operational time loss from completed races"
      className="pit-analysis"
    >
      <section className="pit-toolbar" aria-label="Pit stop analysis controls">
        <div className="pit-segmented" aria-label="Analysis subject">
          <button
            className={analysisType === 'team' ? 'is-active' : ''}
            onClick={() => {
              setAnalysisType('team');
              setSelectedEntity('all');
            }}
            type="button"
          >
            <Users aria-hidden="true" size={16} />
            Teams
          </button>
          <button
            className={analysisType === 'driver' ? 'is-active' : ''}
            onClick={() => {
              setAnalysisType('driver');
              setSelectedEntity('all');
            }}
            type="button"
          >
            <Gauge aria-hidden="true" size={16} />
            Drivers
          </button>
        </div>

        <label className="pit-field">
          <span>Race</span>
          <select
            value={selectedRound}
            onChange={(event) => setSelectedRound(event.target.value)}
          >
            <option value="all">All completed races</option>
            {availableRounds.map((race) => (
              <option key={race.round} value={race.round}>
                R{race.round} · {race.grand_prix}
              </option>
            ))}
          </select>
        </label>

        <label className="pit-field">
          <span>Trend focus</span>
          <select
            value={entityOptions.includes(selectedEntity) ? selectedEntity : 'all'}
            onChange={(event) => setSelectedEntity(event.target.value)}
          >
            <option value="all">Entire field</option>
            {entityOptions.map((entity) => (
              <option key={entity} value={entity}>{entity}</option>
            ))}
          </select>
        </label>

        {error && (
          <button className="pit-refresh" onClick={retry} type="button" title="Retry data load">
            <RefreshCw aria-hidden="true" size={17} />
            Retry
          </button>
        )}
      </section>

      {status === 'loading' && !hasAnyData ? (
        <div className="pit-empty">
          <Activity aria-hidden="true" size={24} />
          <p>Loading pit-stop timing…</p>
        </div>
      ) : !hasAnyData ? (
        <div className="pit-empty">
          <Database aria-hidden="true" size={24} />
          <h2>No pit-stop timing is stored for this season yet</h2>
          <p>The next completed-race update will add Formula1.com and DHL measurements.</p>
        </div>
      ) : (
        <>
          <section className="pit-metrics" aria-label="Pit stop highlights">
            <MetricCard
              detail={coverage.fastestService
                ? `${coverage.fastestService.driver} · ${coverage.fastestService.grandPrix}`
                : 'DHL service timing unavailable'}
              icon={Wrench}
              label="Fastest service"
              tone="gold"
              value={formatSeconds(coverage.fastestService?.serviceTime)}
            />
            <MetricCard
              detail={coverage.quickestPitLane
                ? `${coverage.quickestPitLane.driver} · ${coverage.quickestPitLane.grandPrix}`
                : 'Pit-lane timing unavailable'}
              icon={Timer}
              label="Quickest pit lane"
              tone="blue"
              value={formatSeconds(coverage.quickestPitLane?.pitLaneTime)}
            />
            <MetricCard
              detail={coverage.bestTransitDelta
                ? `${coverage.bestTransitDelta.driver} versus race median`
                : 'Requires matched source timing'}
              icon={Route}
              label="Best transit delta"
              tone="green"
              value={formatSignedSeconds(coverage.bestTransitDelta?.transitDelta)}
            />
            <MetricCard
              detail={`${coverage.serviceStops} DHL · ${coverage.pitLaneStops} Formula1.com`}
              icon={CheckCircle2}
              label="Matched stops"
              value={`${coverage.matchedStops}/${coverage.records}`}
            />
          </section>

          {!hasJoinedData && (
            <div className="pit-data-note">
              <Database aria-hidden="true" size={18} />
              <div>
                <strong>Partial source coverage</strong>
                <span>
                  Service timing is available, but full pit-lane timing has not reached the database for these races.
                </span>
              </div>
            </div>
          )}

          <div className="pit-analysis-grid">
            <ChartPanel
              className="pit-panel--wide"
              description="Median stationary service plus the remaining time travelling through the pit lane"
              title="Where the pit stop time goes"
            >
              {breakdownRankings.length > 0 ? (
                <div
                  className="pit-chart"
                  style={{ height: `${Math.max(360, breakdownRankings.length * 42)}px` }}
                >
                  <Bar data={breakdownData} options={breakdownOptions} />
                </div>
              ) : (
                <div className="pit-chart-empty">Matched DHL and Formula1.com stops are required.</div>
              )}
            </ChartPanel>

            <ChartPanel
              description="Each point is one stop; low and left indicates both a quick crew and quick lane traversal"
              title="Crew speed versus total lane time"
            >
              {matchedRecords.length > 0 ? (
                <div className="pit-chart">
                  <Scatter data={scatterData} options={scatterOptions} />
                </div>
              ) : (
                <div className="pit-chart-empty">No joined stops are available for this selection.</div>
              )}
            </ChartPanel>

            <ChartPanel
              description="Negative values are quicker than the median pit-lane time at the same race"
              title="Time gained or lost in the lane"
            >
              {deltaRankings.length > 0 ? (
                <div
                  className="pit-chart"
                  style={{ height: `${Math.max(360, deltaRankings.length * 38)}px` }}
                >
                  <Bar data={deltaData} options={deltaOptions} />
                </div>
              ) : (
                <div className="pit-chart-empty">Full pit-lane timing is required.</div>
              )}
            </ChartPanel>

            <ChartPanel
              className="pit-panel--wide"
              description="The two scales keep crew service and full pit-lane duration readable together"
              title={`${selectedEntity === 'all' ? 'Field' : selectedEntity} trend by round`}
            >
              <div className="pit-chart pit-chart--trend">
                <Line data={trendData} options={trendOptions} />
              </div>
            </ChartPanel>
          </div>

          <section className="pit-table-section">
            <header className="pit-panel__header">
              <h2>{analysisType === 'team' ? 'Team' : 'Driver'} timing</h2>
              <p>Medians limit the influence of repairs, penalties, and unusually delayed stops.</p>
            </header>
            <div className="pit-table-scroll">
              <table className="pit-table">
                <thead>
                  <tr>
                    <th>{analysisType === 'team' ? 'Team' : 'Driver'}</th>
                    <th>Stops</th>
                    <th>Service</th>
                    <th>Pit lane</th>
                    <th>Transit</th>
                    <th>Race delta</th>
                    <th>Coverage</th>
                  </tr>
                </thead>
                <tbody>
                  {rankings.map((ranking) => (
                    <tr key={ranking.entity}>
                      <td>
                        <TeamLogo
                          size="sm"
                          team={ranking.team}
                          year={selectedYear}
                        />
                        <strong>{ranking.entity}</strong>
                      </td>
                      <td>{ranking.stops}</td>
                      <td>{formatSeconds(ranking.serviceMedian)}</td>
                      <td>{formatSeconds(ranking.pitLaneMedian)}</td>
                      <td>{formatSeconds(ranking.transitMedian)}</td>
                      <td className={
                        Number.isFinite(ranking.laneDeltaMedian)
                          ? ranking.laneDeltaMedian <= 0
                            ? 'is-positive'
                            : 'is-negative'
                          : ''
                      }>
                        {formatSignedSeconds(ranking.laneDeltaMedian)}
                      </td>
                      <td>
                        <span>{ranking.matchedStops}/{ranking.stops}</span>
                        <CoverageBar matched={ranking.matchedStops} total={ranking.stops} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <footer className="pit-source-note">
            <Wrench aria-hidden="true" size={15} />
            <span>DHL measures stationary service. Formula1.com measures the full pit-lane visit.</span>
          </footer>
        </>
      )}
    </F1PageLayout>
  );
};

export default PitStopAnalysisPage;
