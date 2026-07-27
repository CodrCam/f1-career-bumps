import { useMemo, useState, type CSSProperties } from 'react';
import {
  ArrowUpRight,
  Flag,
  Route,
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { CorePageHeader } from '../components/CorePageHeader';
import { CorePageState } from '../components/CorePageState';
import TeamLogo from '../components/TeamLogo.jsx';
import type { PublicationState } from '../data/seasonOverview';
import { useCoreData } from '../hooks/useCoreData';
import { LoadingFrame } from '../ui/LoadingFrame';
import { MetricStrip } from '../ui/MetricStrip';
import { getTeamColor } from '../utils/dataProcessing.js';
import { getSeasonFromParam } from '../utils/seasons.js';
import './CorePages.css';

const stateLabel: Record<PublicationState, string> = {
  scheduled: 'Scheduled',
  awaiting_results: 'Results pending',
  results_ready: 'Results live',
  awaiting_timing: 'Story processing',
  timing_ready: 'Story processing',
  published: 'Story ready',
  degraded: 'Limited story',
  failed: 'Refresh failed',
};

const formatDate = (value?: string) => {
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

type ArchiveFilter = 'all' | 'ready' | 'processing';

const RaceArchive = () => {
  const { seasonYear } = useParams();
  const year = getSeasonFromParam(seasonYear);
  const { envelope, status, error, retry } = useCoreData(year, 'races');
  const [filter, setFilter] = useState<ArchiveFilter>('all');

  const races = useMemo(() => {
    const entries = [...(envelope?.data.races ?? [])].reverse();
    if (filter === 'ready') return entries.filter((race) => race.storyReady);
    if (filter === 'processing') return entries.filter((race) => !race.storyReady);
    return entries;
  }, [envelope, filter]);

  if (!envelope && status === 'loading') return <LoadingFrame label="Loading race archive" />;
  if (!envelope) {
    return <CorePageState year={year} message={error?.message} onRetry={retry} />;
  }

  const ready = envelope.data.races.filter((race) => race.storyReady).length;
  const latest = envelope.data.races.at(-1);

  return (
    <main className="core-page">
      <CorePageHeader
        eyebrow={`Season ${year} / ${envelope.data.races.length} classified rounds`}
        title="Race archive"
        description="Every official result appears immediately. Detailed race stories join the dossier as timing passes publication checks."
        meta={envelope.meta}
      />

      <MetricStrip
        label={`${year} race archive coverage`}
        items={[
          { label: 'Classified', value: envelope.data.races.length, detail: 'Official race results' },
          { label: 'Stories ready', value: ready, detail: `${envelope.data.races.length - ready} processing` },
          { label: 'Latest round', value: latest ? `R${latest.round}` : '—', detail: latest?.grandPrix ?? 'No races' },
          { label: 'Contract', value: envelope.meta.schemaVersion, detail: 'Shared publication status' },
        ]}
      />

      <section className="race-archive">
        <div className="race-archive__toolbar">
          <div>
            <span className="core-page__eyebrow">Dossier index</span>
            <h2>From classification to race story.</h2>
          </div>
          <div className="core-filter" role="group" aria-label="Filter race archive">
            {([
              ['all', 'All races'],
              ['ready', 'Story ready'],
              ['processing', 'Processing'],
            ] as const).map(([value, label]) => (
              <button
                className={filter === value ? 'is-active' : ''}
                key={value}
                type="button"
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="race-archive__grid">
          {races.map((race) => (
            <Link
              className="race-card"
              key={race.round}
              to={`/${year}/races/${race.round}`}
              style={{ '--team-color': getTeamColor(race.winner?.team) } as CSSProperties}
            >
              <span className="race-card__round">R{String(race.round).padStart(2, '0')}</span>
              <span className={`race-card__state state-${race.state}`}>
                {stateLabel[race.state]}
              </span>
              <span className="race-card__date">{formatDate(race.date)}</span>
              <span className="race-card__icon" aria-hidden="true">
                {race.storyReady ? <Route size={21} /> : <Flag size={21} />}
              </span>
              <span className="race-card__title">
                <strong>{race.grandPrix}</strong>
                <small>{race.circuit}</small>
              </span>
              <span className="race-card__winner">
                <TeamLogo size="sm" team={race.winner?.team} tone="team" year={year} />
                <span>
                  <small>Winner</small>
                  <strong>{race.winner?.driver ?? 'Classification pending'}</strong>
                </span>
              </span>
              <span className="race-card__open">
                Open dossier
                <ArrowUpRight aria-hidden="true" size={16} />
              </span>
            </Link>
          ))}
          {races.length === 0 && (
            <p className="core-page__empty">No races match this publication filter.</p>
          )}
        </div>
      </section>
    </main>
  );
};

export default RaceArchive;
