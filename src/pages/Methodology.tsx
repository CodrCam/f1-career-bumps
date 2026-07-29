import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Database,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import './AnalysisPages.css';

const sources = [
  {
    name: 'Formula1.com',
    role: 'Authority for official classifications, grids, points, and published pit-lane summaries.',
  },
  {
    name: 'Slipstream timing recorder',
    role: 'Owned ingestion, immutable raw batches, normalized laps, sectors, positions, pit events, race control, weather, and classifications.',
  },
];

const definitions = [
  ['championship-points', 'Championship points', 'Official race and sprint points accumulated through the latest classified round.'],
  ['race-points', 'Race points', 'Official Grand Prix points accumulated in the selected rounds; sprint points are excluded.'],
  ['sprint-points', 'Sprint points', 'Official sprint points accumulated in the selected rounds.'],
  ['race-wins', 'Race wins', 'Race classifications in which the driver finished first. Sprint wins are kept separate.'],
  ['podiums', 'Podiums', 'Race classifications in positions one through three.'],
  ['race-starts', 'Race starts', 'Driver entries present in the selected official race classifications.'],
  ['points-per-start', 'Points per start', 'Race and sprint points divided by the driver’s classified race starts.'],
  ['average-finish', 'Average finish', 'Arithmetic mean of numeric race classification positions. Non-starts without a numeric classification are excluded.'],
  ['average-grid', 'Average grid', 'Arithmetic mean of numeric starting-grid positions in the selected races.'],
  ['average-qualifying', 'Average qualifying', 'Arithmetic mean of official qualifying positions from sessions containing the driver.'],
  ['reliability', 'Reliability', 'The share of race starts not labeled DNF, DNS, DSQ, retired, or not classified.'],
  ['non-finishes', 'Non-finishes', 'Count of selected entries labeled DNF, DNS, DSQ, retired, or not classified.'],
  ['positions-gained', 'Net positions gained', 'Sum of starting-grid position minus classified finishing position across selected races.'],
  ['finish-consistency', 'Finishing consistency', 'Population standard deviation of numeric race classification positions; a lower value is more consistent.'],
  ['best-finish', 'Best finish', 'The lowest numeric Grand Prix classification position in the selected rounds.'],
  ['recent-form', 'Recent form', 'The latest five classified race results, with race and sprint points retained in each round.'],
  ['race-head-to-head', 'Race head-to-head', 'Shared rounds where both drivers have numeric race classifications; the higher finisher wins the round.'],
  ['qualifying-head-to-head', 'Qualifying head-to-head', 'Shared rounds where both drivers have qualifying positions; the lower position number wins.'],
  ['sprint-head-to-head', 'Sprint head-to-head', 'Shared sprint classifications only. Missing sprint entries are excluded.'],
  ['best-lap-time', 'Best lap time', 'The fastest valid lap duration for the driver in the selected session.'],
  ['average-lap-time', 'Average lap time', 'The arithmetic mean of valid, non-pit-out laps below the plausibility ceiling.'],
  ['best-sector-time', 'Best sector time', 'The driver’s minimum valid duration for the selected sector.'],
  ['average-sector-time', 'Average sector time', 'The driver’s mean valid duration for the selected sector.'],
  ['pace-sample', 'Pace sample', 'Completed sessions published by the Slipstream recorder. Pit-out laps, missing times, and implausible laps above five minutes are excluded.'],
  ['pit-service-time', 'Stationary service time', 'Time between owned pit-service start and completion events when that capability is present.'],
  ['pit-lane-time', 'Full pit-lane time', 'Official duration from pit entry through pit exit, including transit and stationary service.'],
  ['pit-transit-time', 'Pit transit time', 'Full pit-lane time minus stationary service, calculated only for a safe driver-and-lap match.'],
  ['pit-clock-matching', 'Matched pit clocks', 'A service record and official lane record sharing the same normalized driver and lap.'],
  ['pit-time-distribution', 'Pit timing distribution', 'The selected stop times divided into six equal-width intervals from the sample minimum to maximum.'],
  ['pit-source-authority', 'Pit source authority', 'Each clock retains its own source. A missing service time is not inferred from a lane time, or vice versa.'],
];

const states = [
  ['published', 'Analysis current', 'Official results and validated detailed timing are available.', CheckCircle2],
  ['results_ready', 'Results published', 'Official classification is live while detailed timing continues processing.', Clock3],
  ['degraded', 'Limited analysis', 'Results remain available, but one or more enrichment capabilities are missing.', AlertTriangle],
  ['failed', 'Refresh needs attention', 'The latest enrichment attempt failed validation and requires a retry.', AlertTriangle],
];

const Methodology = () => (
  <main className="methodology-page">
    <header className="methodology-hero">
      <span className="core-page__eyebrow">Sources / calculations / limitations</span>
      <h1>Methodology</h1>
      <p>
        Slipstream publishes the official result first, then adds derived analysis
        only when the underlying timing passes source and capability checks.
      </p>
      <div>
        <span>Schema <strong>2.0</strong></span>
        <span>Publication model <strong>progressive</strong></span>
      </div>
    </header>

    <nav className="methodology-index" aria-label="Methodology sections">
      <a href="#sources">Sources</a>
      <a href="#publication-states">Publication states</a>
      <a href="#definitions">Metric definitions</a>
      <a href="#limitations">Known limitations</a>
    </nav>

    <section id="sources" className="methodology-section">
      <header>
        <span className="core-page__eyebrow">Authority rules</span>
        <h2>Source catalog</h2>
        <p>No source is asked to measure something it does not actually clock.</p>
      </header>
      <div className="methodology-sources">
        {sources.map((source, index) => (
          <article key={source.name}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <Database aria-hidden="true" size={19} />
            <h3>{source.name}</h3>
            <p>{source.role}</p>
          </article>
        ))}
      </div>
    </section>

    <section id="publication-states" className="methodology-section">
      <header>
        <span className="core-page__eyebrow">Freshness language</span>
        <h2>Publication states</h2>
        <p>The same state labels appear on season, race, championship, and analysis pages.</p>
      </header>
      <div className="methodology-states">
        {states.map(([state, label, detail, Icon]) => (
          <article className={`state-${state}`} key={state as string}>
            <Icon aria-hidden="true" size={19} />
            <span>{state as string}</span>
            <h3>{label as string}</h3>
            <p>{detail as string}</p>
          </article>
        ))}
      </div>
    </section>

    <section id="definitions" className="methodology-section">
      <header>
        <span className="core-page__eyebrow">Reproducible statistics</span>
        <h2>Metric definitions</h2>
        <p>Every Phase 3 metric links back to one of these deterministic calculations.</p>
      </header>
      <dl className="methodology-definitions">
        {definitions.map(([id, term, detail]) => (
          <div id={id} key={id}>
            <dt>{term}</dt>
            <dd>{detail}</dd>
          </div>
        ))}
      </dl>
    </section>

    <section id="limitations" className="methodology-section methodology-limitations">
      <header>
        <span className="core-page__eyebrow">Known gaps</span>
        <h2>What the data cannot always say</h2>
      </header>
      <ul>
        <li>Detailed timing can arrive after the official classification and may remain incomplete for historical rounds.</li>
        <li>Head-to-head samples exclude rounds where either selected driver has no comparable session result.</li>
        <li>Average finishing position describes classification order; it is not a pure pace measurement.</li>
        <li>Pit-service and full-lane clocks are joined only when driver and lap identity agree.</li>
        <li>Strategy context is descriptive and does not claim a counterfactual race outcome.</li>
      </ul>
    </section>

    <footer className="methodology-footer">
      <div>
        <span className="core-page__eyebrow">Continue exploring</span>
        <h2>Return to the live season desk.</h2>
      </div>
      <Link to="/2026">
        Open current season
        <ArrowUpRight aria-hidden="true" size={16} />
      </Link>
    </footer>
  </main>
);

export default Methodology;
