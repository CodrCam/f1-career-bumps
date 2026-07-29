import type { CSSProperties } from 'react';
import {
  ArrowLeft,
  Flag,
  Route,
  TimerReset,
  TrafficCone,
  Wrench,
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { CorePageHeader } from '../components/CorePageHeader';
import { CorePageState } from '../components/CorePageState';
import TeamLogo from '../components/TeamLogo.jsx';
import { useCoreData } from '../hooks/useCoreData';
import { DataStatus } from '../ui/DataStatus';
import { LoadingFrame } from '../ui/LoadingFrame';
import { MetricStrip } from '../ui/MetricStrip';
import { getTeamColor } from '../utils/dataProcessing.js';
import { getSeasonFromParam } from '../utils/seasons.js';
import './CorePages.css';

const textValue = (value: unknown, fallback = '—') => (
  typeof value === 'string' || typeof value === 'number' ? String(value) : fallback
);

const numberValue = (value: unknown) => {
  const candidate = Number(value);
  return Number.isFinite(candidate) ? candidate : null;
};

const formatDate = (value?: string) => {
  if (!value) return 'Date unavailable';
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
};

const formatGridDelta = (value: number | null) => {
  if (value === null) return 'Grid —';
  if (value === 0) return 'Held grid';
  return `${value > 0 ? '+' : ''}${value} from grid`;
};

const RaceDossier = () => {
  const { seasonYear, round } = useParams();
  const year = getSeasonFromParam(seasonYear);
  const raceRound = Number(round);
  const { envelope, status, error, retry } = useCoreData(year, 'race', raceRound);

  if (!envelope && status === 'loading') return <LoadingFrame label="Loading race dossier" />;
  if (!envelope) {
    return <CorePageState year={year} message={error?.message} onRetry={retry} />;
  }

  const { data, meta } = envelope;
  const analysis = data.analysis;
  const summary = analysis?.summary;
  const overtakes = analysis?.overtakeEvents ?? [];
  const pitCycles = analysis?.pitCycleEvents ?? [];
  const attrition = analysis?.attritionEvents ?? [];
  const winner = data.classification[0];
  const biggestMover = [...data.classification].sort((left, right) => (
    (right.gridDelta ?? -99) - (left.gridDelta ?? -99)
  ))[0];

  return (
    <main className="core-page race-dossier">
      <CorePageHeader
        eyebrow={`Season ${year} / round ${data.race.round}`}
        title={data.race.grandPrix}
        description={`${formatDate(data.race.date)} · ${data.race.circuit ?? 'Circuit unavailable'}`}
        meta={meta}
        actions={(
          <Link className="core-page__switch" to={`/${year}/races`}>
            <ArrowLeft aria-hidden="true" size={15} />
            Race archive
          </Link>
        )}
      />

      <section className="dossier-lede">
        <div className="dossier-winner" style={{ '--team-color': getTeamColor(winner?.team) } as CSSProperties}>
          <span className="core-page__eyebrow">Official winner</span>
          <TeamLogo size="lg" team={winner?.team} tone="team" year={year} />
          <div>
            <h2>{winner?.driver ?? 'Classification pending'}</h2>
            <p>{winner?.team} · {winner?.time ?? 'Official time unavailable'}</p>
          </div>
          <Flag aria-hidden="true" size={28} />
        </div>
        <DataStatus
          state={meta.state}
          updatedAt={meta.publishedAt}
          detail={analysis
            ? 'Official classification and detailed timing analysis are published.'
            : 'The official classification is live. Detailed timing is still processing.'}
        />
      </section>

      <MetricStrip
        label={`${data.race.grandPrix} race summary`}
        items={[
          {
            label: 'Retained passes',
            value: summary?.retained_overtakes ?? '—',
            detail: analysis ? 'Two-lap retention check' : 'Timing processing',
          },
          {
            label: 'Pit cycles',
            value: summary?.pit_cycles ?? '—',
            detail: analysis ? 'Measured stop sequences' : 'Timing processing',
          },
          {
            label: 'Attrition',
            value: summary?.attrition_events ?? '—',
            detail: 'Race-ending events',
          },
          {
            label: 'Biggest mover',
            value: biggestMover?.gridDelta != null && biggestMover.gridDelta > 0
              ? `+${biggestMover.gridDelta}`
              : '—',
            detail: biggestMover?.driver ?? 'No grid delta',
          },
        ]}
      />

      <section className="dossier-grid">
        <article className="dossier-classification">
          <div className="core-section-heading">
            <div>
              <span className="core-page__eyebrow">Official result</span>
              <h2>Full classification</h2>
            </div>
            <span>{data.classification.length} classified entries</span>
          </div>
          <ol>
            {data.classification.map((result) => (
              <li
                key={`${result.position}-${result.driver}`}
                style={{ '--team-color': getTeamColor(result.team) } as CSSProperties}
              >
                <span className="classification-rank">
                  {result.position ? `P${result.position}` : 'NC'}
                </span>
                <TeamLogo size="xs" team={result.team} tone="team" year={year} />
                <span className="classification-driver">
                  <strong>{result.driver ?? result.code ?? 'Driver'}</strong>
                  <small>{result.team}</small>
                </span>
                <span className="classification-grid">{formatGridDelta(result.gridDelta)}</span>
                <span className="classification-time">
                  <strong>{result.time ?? result.status}</strong>
                  <small>+{result.points} pts</small>
                </span>
              </li>
            ))}
          </ol>
        </article>

        <aside className="dossier-analysis">
          <div className="core-section-heading">
            <div>
              <span className="core-page__eyebrow">Race-shaping detail</span>
              <h2>{analysis ? 'Timing story' : 'Analysis queued'}</h2>
            </div>
            <Route aria-hidden="true" size={21} />
          </div>

          {!analysis ? (
            <div className="dossier-analysis__empty">
              <TimerReset aria-hidden="true" size={28} />
              <h3>The classification does not wait for telemetry.</h3>
              <p>
                Results are published now. This panel refreshes automatically when
                overtakes, pit cycles, and attrition pass validation.
              </p>
            </div>
          ) : (
            <>
              <div className="dossier-event-group">
                <h3><TrafficCone aria-hidden="true" size={16} /> Pivotal passes</h3>
                {overtakes.slice(0, 6).map((event, index) => (
                  <div className="dossier-event" key={textValue(event.id, `pass-${index}`)}>
                    <span>L{textValue(event.lap)}</span>
                    <p>
                      <strong>{textValue(event.driver)}</strong> passed{' '}
                      {textValue(event.opponent)} for P{textValue(event.to_position)}
                    </p>
                    <small>
                      {textValue(event.positions_gained, '1')} place
                      {numberValue(event.positions_gained) === 1 ? '' : 's'} gained
                    </small>
                  </div>
                ))}
                {overtakes.length === 0 && <p className="core-page__empty">No retained pass events published.</p>}
              </div>

              <div className="dossier-event-group">
                <h3><Wrench aria-hidden="true" size={16} /> Pit cycles</h3>
                {pitCycles.slice(0, 5).map((event, index) => {
                  const delta = numberValue(event.position_delta);
                  const pitLap = textValue(event.pit_lap ?? event.lap);
                  const pitDriver = textValue(event.driver);
                  return (
                    <Link
                      className="dossier-event dossier-event--link"
                      key={textValue(event.id, `pit-${index}`)}
                      title="Highlight this stop in Pit Lane"
                      to={`/${year}/pit-lane?round=${data.race.round}&driver=${encodeURIComponent(pitDriver)}&lap=${encodeURIComponent(pitLap)}#pit-stop-scatter`}
                    >
                      <span>L{pitLap}</span>
                      <p>
                        <strong>{pitDriver}</strong> ·{' '}
                        {textValue(event.strategy_context, 'green flag stop').replaceAll('_', ' ')}
                      </p>
                      <small>{delta === null || delta === 0 ? 'Position held' : `${delta > 0 ? '+' : ''}${delta} positions`}</small>
                    </Link>
                  );
                })}
                {pitCycles.length === 0 && <p className="core-page__empty">No pit-cycle events published.</p>}
              </div>

              {attrition.length > 0 && (
                <details className="dossier-details">
                  <summary>{attrition.length} attrition event{attrition.length === 1 ? '' : 's'}</summary>
                  {attrition.map((event, index) => (
                    <p key={textValue(event.id, `attrition-${index}`)}>
                      L{textValue(event.lap)} · <strong>{textValue(event.driver)}</strong> · {textValue(event.status)}
                    </p>
                  ))}
                </details>
              )}
            </>
          )}
        </aside>
      </section>
    </main>
  );
};

export default RaceDossier;
