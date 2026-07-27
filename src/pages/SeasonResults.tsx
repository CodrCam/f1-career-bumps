import { useState, type CSSProperties } from 'react';
import { BarChart3 } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { CorePageHeader } from '../components/CorePageHeader';
import { CorePageState } from '../components/CorePageState';
import TeamLogo from '../components/TeamLogo.jsx';
import type { ResultCell } from '../data/coreData';
import { useCoreData } from '../hooks/useCoreData';
import { LoadingFrame } from '../ui/LoadingFrame';
import { MetricStrip } from '../ui/MetricStrip';
import { getTeamColor } from '../utils/dataProcessing.js';
import { getSeasonFromParam } from '../utils/seasons.js';
import './CorePages.css';

type MatrixMode = 'position' | 'points' | 'gridDelta' | 'status';

const resultLabel = (result: ResultCell | undefined, mode: MatrixMode) => {
  if (!result) return '—';
  if (mode === 'position') return result.position ? `P${result.position}` : result.status;
  if (mode === 'points') return result.points ? `+${result.points}` : '0';
  if (mode === 'gridDelta') {
    if (result.gridDelta === null) return '—';
    if (result.gridDelta === 0) return '0';
    return `${result.gridDelta > 0 ? '+' : ''}${result.gridDelta}`;
  }
  return result.status;
};

const cellClass = (result: ResultCell | undefined, mode: MatrixMode) => {
  if (!result) return 'is-empty';
  if (mode === 'position' && result.position && result.position <= 3) return `is-podium p${result.position}`;
  if (mode === 'gridDelta' && result.gridDelta) return result.gridDelta > 0 ? 'is-positive' : 'is-negative';
  if (mode === 'status' && /dnf|dns|dsq|retired/i.test(result.status)) return 'is-negative';
  return '';
};

const SeasonResults = () => {
  const { seasonYear } = useParams();
  const year = getSeasonFromParam(seasonYear);
  const { envelope, status, error, retry } = useCoreData(year, 'results');
  const [mode, setMode] = useState<MatrixMode>('position');
  const [selectedDriver, setSelectedDriver] = useState('');

  if (!envelope && status === 'loading') return <LoadingFrame label="Loading season results" />;
  if (!envelope) {
    return <CorePageState year={year} message={error?.message} onRetry={retry} />;
  }

  const activeDriver = selectedDriver || envelope.data.drivers[0]?.name || '';
  const wins = envelope.data.drivers.reduce((total, driver) => (
    total + Object.values(driver.results).filter((result) => result.position === 1).length
  ), 0);

  return (
    <main className="core-page">
      <CorePageHeader
        eyebrow={`Season ${year} / through round ${envelope.data.throughRound}`}
        title="Season results matrix"
        description="Scan the entire grid by finish, points, grid movement, or classification status without changing pages."
        meta={envelope.meta}
      />

      <MetricStrip
        label={`${year} results matrix summary`}
        items={[
          { label: 'Rounds', value: envelope.data.races.length, detail: 'Completed classifications' },
          { label: 'Drivers', value: envelope.data.drivers.length, detail: 'Season participants' },
          { label: 'Wins', value: wins, detail: 'Across the classified field' },
          { label: 'View', value: mode === 'gridDelta' ? 'Δ grid' : mode, detail: 'Selected matrix measure' },
        ]}
      />

      <section className="results-matrix">
        <div className="results-matrix__toolbar">
          <div>
            <span className="core-page__eyebrow">Field scan</span>
            <h2>One row per driver. One column per race.</h2>
          </div>
          <div className="results-matrix__controls">
            <label>
              <span>Measure</span>
              <select value={mode} onChange={(event) => setMode(event.target.value as MatrixMode)}>
                <option value="position">Finish</option>
                <option value="points">Points</option>
                <option value="gridDelta">Grid delta</option>
                <option value="status">Status</option>
              </select>
            </label>
            <label className="results-matrix__driver-select">
              <span>Mobile driver</span>
              <select value={activeDriver} onChange={(event) => setSelectedDriver(event.target.value)}>
                {envelope.data.drivers.map((driver) => (
                  <option key={driver.name} value={driver.name}>{driver.name}</option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="results-matrix__scroll" tabIndex={0} aria-label="Scrollable season results table">
          <table>
            <thead>
              <tr>
                <th scope="col">Driver</th>
                {envelope.data.races.map((race) => (
                  <th key={race.round} scope="col" title={race.grandPrix}>
                    <span>R{race.round}</span>
                    <small>{race.grandPrix.replace(/ Grand Prix$/i, '').slice(0, 3).toUpperCase()}</small>
                  </th>
                ))}
                <th scope="col">PTS</th>
              </tr>
            </thead>
            <tbody>
              {envelope.data.drivers.map((driver) => (
                <tr
                  className={driver.name === activeDriver ? 'is-selected' : ''}
                  key={driver.name}
                  style={{ '--team-color': getTeamColor(driver.team) } as CSSProperties}
                >
                  <th scope="row">
                    <TeamLogo size="xs" team={driver.team} tone="team" year={year} />
                    <span>
                      <strong>{driver.name}</strong>
                      <small>{driver.team}</small>
                    </span>
                  </th>
                  {envelope.data.races.map((race) => {
                    const result = driver.results[race.round];
                    return (
                      <td
                        className={cellClass(result, mode)}
                        key={race.round}
                        title={`${race.grandPrix}: ${resultLabel(result, mode)}`}
                      >
                        {resultLabel(result, mode)}
                      </td>
                    );
                  })}
                  <td className="results-matrix__points">{driver.totalPoints}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="results-matrix__hint">
          <BarChart3 aria-hidden="true" size={14} />
          The table scrolls horizontally; phones show the selected driver only.
        </p>
      </section>
    </main>
  );
};

export default SeasonResults;
