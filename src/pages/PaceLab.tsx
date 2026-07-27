import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  Activity,
  Database,
  Gauge,
} from 'lucide-react';
import { useParams, useSearchParams } from 'react-router-dom';
import { CorePageHeader } from '../components/CorePageHeader';
import { CorePageState } from '../components/CorePageState';
import { DriverIdentity } from '../components/DriverIdentity';
import type { PaceDriver } from '../data/paceData';
import { useAnalysisData } from '../hooks/useAnalysisData';
import { usePaceSessionData, usePaceSessions } from '../hooks/usePaceData';
import { AnalysisState } from '../ui/AnalysisState';
import { FilterBar, FilterField, SegmentedControl } from '../ui/AnalysisControls';
import { DefinitionLink } from '../ui/DefinitionLink';
import { LoadingFrame } from '../ui/LoadingFrame';
import { MetricStrip } from '../ui/MetricStrip';
import { PaceGapFormation } from '../ui/PaceGapFormation';
import { ResponsiveDataView, type DataColumn } from '../ui/ResponsiveDataView';
import { getSeasonFromParam } from '../utils/seasons.js';
import './AnalysisPages.css';

type PaceMetric = 'lap' | 'sector1' | 'sector2' | 'sector3';
type LapTreatment = 'best' | 'average';

interface PaceRow extends PaceDriver {
  value: number;
  gap: number;
  displayRank: number;
}

const formatSeconds = (value: number | null, digits = 3) => (
  value === null ? '—' : `${value.toFixed(digits)}s`
);

const getPaceValue = (
  driver: PaceDriver,
  metric: PaceMetric,
  treatment: LapTreatment,
) => {
  if (metric === 'lap') return treatment === 'best' ? driver.bestLap : driver.averageLap;
  const index = { sector1: 0, sector2: 1, sector3: 2 }[metric];
  return treatment === 'best' ? driver.bestSectors[index] : driver.averageSectors[index];
};

const PaceLab = () => {
  const { seasonYear } = useParams();
  const year = getSeasonFromParam(seasonYear);
  const [searchParams, setSearchParams] = useSearchParams();
  const { envelope, status, error, retry } = useAnalysisData(year, 'pace');
  const sessionsState = usePaceSessions(year);
  const requestedSession = Number(searchParams.get('session'));
  const activeSession = sessionsState.sessions.find(
    (session) => session.sessionKey === requestedSession,
  ) ?? sessionsState.sessions[0];
  const sessionState = usePaceSessionData(year, activeSession?.sessionKey);
  const [metric, setMetric] = useState<PaceMetric>('lap');
  const [treatment, setTreatment] = useState<LapTreatment>('best');
  const [selectedDrivers, setSelectedDrivers] = useState<Set<number>>(new Set());
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (!activeSession || requestedSession === activeSession.sessionKey) return;
    const next = new URLSearchParams(searchParams);
    next.set('session', String(activeSession.sessionKey));
    setSearchParams(next, { replace: true });
  }, [activeSession, requestedSession, searchParams, setSearchParams]);

  useEffect(() => {
    if (!sessionState.data) return;
    setSelectedDrivers(new Set(
      sessionState.data.drivers.map((driver) => driver.driverNumber),
    ));
    setShowAll(false);
  }, [sessionState.data?.sessionKey]);

  const rows = useMemo<PaceRow[]>(() => {
    const values = (sessionState.data?.drivers ?? []).flatMap((driver) => {
      const value = getPaceValue(driver, metric, treatment);
      return value === null ? [] : [{ ...driver, value }];
    }).filter((driver) => (
      selectedDrivers.size === 0 || selectedDrivers.has(driver.driverNumber)
    )).sort((left, right) => left.value - right.value);
    const fastest = values[0]?.value ?? 0;
    return values.map((driver, index) => ({
      ...driver,
      gap: driver.value - fastest,
      displayRank: index + 1,
    }));
  }, [metric, selectedDrivers, sessionState.data, treatment]);

  const columns = useMemo<Array<DataColumn<PaceRow>>>(() => [
    {
      id: 'driver',
      header: 'Driver',
      render: (driver) => (
        <DriverIdentity
          name={driver.name}
          code={driver.acronym}
          team={driver.team}
          year={year}
        />
      ),
    },
    {
      id: 'rank',
      header: 'Rank',
      align: 'center',
      render: (driver) => `P${driver.displayRank}`,
    },
    {
      id: 'time',
      header: treatment === 'best' ? 'Best time' : 'Average time',
      align: 'right',
      render: (driver) => formatSeconds(driver.value),
    },
    {
      id: 'gap',
      header: 'Gap',
      align: 'right',
      render: (driver) => driver.gap === 0 ? 'Fastest' : `+${driver.gap.toFixed(3)}s`,
    },
    {
      id: 'laps',
      header: 'Valid laps',
      align: 'right',
      render: (driver) => driver.validLaps,
    },
    {
      id: 'consistency',
      header: 'Variation',
      align: 'right',
      render: (driver) => formatSeconds(driver.consistency),
    },
  ], [treatment, year]);
  const visibleRows = showAll ? rows : rows.slice(0, 10);

  if (!envelope && status === 'loading') return <LoadingFrame label="Loading Pace Lab" />;
  if (!envelope) {
    return <CorePageState year={year} message={error?.message} onRetry={retry} />;
  }

  const readyRaces = envelope.data.races.filter((race) => race.detailedTimingReady).length;
  const updateSession = (sessionKey: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('session', sessionKey);
    setSearchParams(next, { replace: true });
  };
  const toggleDriver = (driverNumber: number) => {
    setSelectedDrivers((current) => {
      const next = new Set(current);
      if (next.has(driverNumber) && next.size > 1) next.delete(driverNumber);
      else next.add(driverNumber);
      return next;
    });
  };
  const fastest = rows[0];
  const valueRange = Math.max(0.001, (rows.at(-1)?.value ?? 0) - (fastest?.value ?? 0));

  return (
    <main className="core-page analysis-page">
      <CorePageHeader
        eyebrow={`Season ${year} / technical workspace`}
        title="Pace Lab"
        description="Compare completed session pace only after checking timing availability, lap treatment, and the exact driver sample."
        meta={envelope.meta}
      />

      <MetricStrip
        label={`${year} pace coverage`}
        items={[
          { label: 'Sessions', value: sessionsState.sessions.length || '—', detail: 'Race, qualifying, sprint' },
          { label: 'Story timing', value: readyRaces, detail: `${envelope.data.races.length} classified races` },
          {
            label: 'Driver sample',
            value: selectedDrivers.size || sessionState.data?.drivers.length || '—',
            detail: rows.length > 10 && !showAll ? 'Top 10 shown' : 'Full field shown',
          },
          { label: 'Source', value: 'OpenF1', detail: sessionState.data ? `Fetched ${new Date(sessionState.data.fetchedAt).toLocaleTimeString()}` : 'Session timing' },
        ]}
      />

      <FilterBar title="Select the timing sample">
        <FilterField className="is-wide" label="Completed session">
          <select
            value={activeSession?.sessionKey ?? ''}
            disabled={sessionsState.status !== 'ready'}
            onChange={(event) => updateSession(event.target.value)}
          >
            {sessionsState.sessions.map((session) => (
              <option key={session.sessionKey} value={session.sessionKey}>
                {session.meetingName} · {session.sessionName}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Timing metric">
          <select value={metric} onChange={(event) => setMetric(event.target.value as PaceMetric)}>
            <option value="lap">Full lap</option>
            <option value="sector1">Sector 1</option>
            <option value="sector2">Sector 2</option>
            <option value="sector3">Sector 3</option>
          </select>
        </FilterField>
        <FilterField label="Lap treatment">
          <SegmentedControl
            label="Lap treatment"
            value={treatment}
            options={[
              { value: 'best', label: 'Best' },
              { value: 'average', label: 'Average' },
            ]}
            onChange={setTreatment}
          />
        </FilterField>
      </FilterBar>

      {sessionsState.status === 'loading' && (
        <AnalysisState
          state="loading"
          title="Checking completed sessions"
          detail="Pace Lab verifies OpenF1 timing availability before mounting the comparison."
        />
      )}
      {sessionsState.status === 'error' && (
        <AnalysisState
          state="error"
          title="Session catalog unavailable"
          detail={`${sessionsState.error?.message}. Source: OpenF1 session timing.`}
          onRetry={sessionsState.retry}
        />
      )}
      {sessionsState.status === 'ready' && sessionState.status === 'loading' && (
        <AnalysisState
          state="loading"
          title="Loading the selected timing sample"
          detail={`${activeSession?.meetingName ?? 'The session'} is available; laps and driver identities are being collected.`}
        />
      )}
      {sessionState.status === 'error' && (
        <AnalysisState
          state="error"
          title="Detailed timing is unavailable"
          detail={`${sessionState.error?.message}. The session selection remains available for a retry.`}
          onRetry={sessionState.retry}
        />
      )}

      {sessionState.data && sessionState.status === 'ready' && (
        <>
          <details className="pace-driver-picker">
            <summary>
              Driver sample · {selectedDrivers.size || sessionState.data.drivers.length} of {sessionState.data.drivers.length} included
            </summary>
            <div>
              {sessionState.data.drivers.map((driver) => {
                const selected = selectedDrivers.has(driver.driverNumber);
                return (
                  <button
                    className={selected ? 'is-selected' : ''}
                    key={driver.driverNumber}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleDriver(driver.driverNumber)}
                    style={{ '--driver-color': driver.color } as CSSProperties}
                  >
                    <span>{driver.acronym}</span>
                    <small>{driver.team}</small>
                  </button>
                );
              })}
            </div>
          </details>

          {rows.length > 1 && (
            <PaceGapFormation
              drivers={rows}
              location={activeSession?.location}
              meetingName={activeSession?.meetingName}
              metric={metric}
              sessionName={activeSession?.sessionName}
              treatment={treatment}
              year={year}
            />
          )}

          <section className="analysis-panel pace-tower">
            <header className="analysis-panel__header">
              <div>
                <span className="core-page__eyebrow">Relative timing order</span>
                <h2>{activeSession?.meetingName} · {activeSession?.sessionName}</h2>
              </div>
              <DefinitionLink definition={metric === 'lap' ? `${treatment}-lap-time` : `${treatment}-sector-time`} />
            </header>
            {rows.length ? (
              <>
                <p className="analysis-summary">
                  {fastest.name} leads this selected {treatment} {metric.replace('sector', 'sector ')}
                  {' '}sample at {formatSeconds(fastest.value)} across {sessionState.data.validLaps} valid laps.
                </p>
                <ol className="pace-tower__rows">
                  {visibleRows.map((driver) => {
                    const relative = 100 - ((driver.value - fastest.value) / valueRange) * 42;
                    return (
                      <li key={driver.driverNumber}>
                        <span className="pace-tower__rank">{String(driver.displayRank).padStart(2, '0')}</span>
                        <DriverIdentity name={driver.name} code={driver.acronym} team={driver.team} year={year} />
                        <span className="pace-tower__bar">
                          <i style={{ width: `${Math.max(54, relative)}%`, background: driver.color }} />
                        </span>
                        <strong>{formatSeconds(driver.value)}</strong>
                        <small>{driver.gap === 0 ? 'FASTEST' : `+${driver.gap.toFixed(3)}`}</small>
                      </li>
                    );
                  })}
                </ol>
                {rows.length > 10 && (
                  <button
                    className="pace-tower__toggle"
                    type="button"
                    onClick={() => setShowAll((current) => !current)}
                  >
                    {showAll ? 'Show top 10' : `Expand to all ${rows.length} drivers`}
                  </button>
                )}
              </>
            ) : (
              <AnalysisState
                state="empty"
                title="No valid laps match the sample"
                detail="Select at least one driver with valid timing or change the timing metric."
              />
            )}
          </section>

          <section className="analysis-panel">
            <header className="analysis-panel__header">
              <div>
                <span className="core-page__eyebrow">Accessible timing evidence</span>
                <h2>Selected driver data</h2>
              </div>
              <Database aria-hidden="true" size={19} />
            </header>
            <ResponsiveDataView
              rows={visibleRows}
              columns={columns}
              getKey={(driver) => String(driver.driverNumber)}
              label="Pace Lab timing results"
            />
          </section>

          <aside className="analysis-source-note">
            <Gauge aria-hidden="true" size={16} />
            <p>
              OpenF1 session timing · {sessionState.data.validLaps} valid laps ·
              {' '}pit-out laps and invalid or implausible lap durations are excluded.
            </p>
            <DefinitionLink definition="pace-sample" children="Read sample rules" />
          </aside>
        </>
      )}
    </main>
  );
};

export default PaceLab;
