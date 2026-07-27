import {
  ArrowUpRight,
  BookOpen,
  Calculator,
  Check,
  Database,
  Search,
  ShieldCheck,
} from 'lucide-react';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CorePageHeader } from '../components/CorePageHeader';
import { CorePageState } from '../components/CorePageState';
import type {
  StatisticsEvidence,
  StatisticsQuery,
  StatisticsRow,
} from '../data/queryData';
import { statisticsMetricOptions } from '../data/queryData';
import { useAnalysisData } from '../hooks/useAnalysisData';
import { useStatisticsQuery } from '../hooks/useStatisticsQuery';
import {
  FilterBar,
  FilterField,
  SegmentedControl,
} from '../ui/AnalysisControls';
import { AnalysisState } from '../ui/AnalysisState';
import { LoadingFrame } from '../ui/LoadingFrame';
import {
  ResponsiveDataView,
  type DataColumn,
} from '../ui/ResponsiveDataView';
import {
  AVAILABLE_SEASONS,
  CURRENT_SEASON,
  getSeasonFromParam,
} from '../utils/seasons.js';
import './AnalysisPages.css';
import './AskWorkspace.css';

const suggestedQuestions = [
  'Who has the most championship points?',
  'Which driver has the best average finish?',
  'Show the top 5 most reliable drivers.',
  'Who gained the most positions from round 5?',
  'Which Ferrari driver has scored the most points?',
  'Who has the best average qualifying position?',
];

const position = (value: number | null) => value ? `P${value}` : '—';

const AskWorkspace = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSeason = getSeasonFromParam(
    searchParams.get('season') ?? CURRENT_SEASON,
  );
  const [year, setYear] = useState(initialSeason);
  const [question, setQuestion] = useState(searchParams.get('q') ?? '');
  const [editorQuery, setEditorQuery] = useState<StatisticsQuery | null>(null);
  const pendingQuestion = useRef<string | null>(null);
  const autoRunKey = useRef('');
  const {
    envelope,
    status: directoryStatus,
    error: directoryError,
    retry: retryDirectory,
  } = useAnalysisData(year, 'drivers');
  const {
    result,
    status,
    error,
    execute,
    reset,
  } = useStatisticsQuery(envelope);

  useEffect(() => {
    const routeYear = getSeasonFromParam(
      searchParams.get('season') ?? CURRENT_SEASON,
    );
    if (routeYear === year) return;
    reset();
    setEditorQuery(null);
    setYear(routeYear);
  }, [reset, searchParams, year]);

  useEffect(() => {
    if (result) setEditorQuery(result.data.query);
  }, [result]);

  useEffect(() => {
    if (!envelope || envelope.data.year !== year) return;
    const pending = pendingQuestion.current;
    if (pending) {
      pendingQuestion.current = null;
      void execute({ question: pending, season: year });
      return;
    }
    const requested = searchParams.get('q')?.trim();
    const key = `${year}:${requested}`;
    if (requested && autoRunKey.current !== key) {
      autoRunKey.current = key;
      setQuestion(requested);
      void execute({ question: requested, season: year });
    }
  }, [envelope, execute, searchParams, year]);

  const resultColumns = useMemo<Array<DataColumn<StatisticsRow>>>(() => {
    if (!result) return [];
    return [
      {
        id: 'driver',
        header: 'Driver',
        render: (row) => (
          <Link className="analysis-table-link" to={`/${year}/drivers/${row.id}`}>
            <strong>{row.entity}</strong>
            <small>{row.code ?? '—'} · {row.team ?? 'Team unavailable'}</small>
          </Link>
        ),
      },
      ...result.data.query.metrics.map((metricId) => {
        const option = statisticsMetricOptions.find((entry) => entry.id === metricId);
        return {
          id: metricId,
          header: option?.label ?? metricId,
          mobileLabel: option?.label ?? metricId,
          align: 'right' as const,
          render: (row: StatisticsRow) => (
            <span className="ask-result-value">
              <strong>{row.values[metricId]?.formatted ?? 'Unavailable'}</strong>
              <small>{row.values[metricId]?.sampleSize ?? 0} samples</small>
            </span>
          ),
        };
      }),
      {
        id: 'races',
        header: 'Race rows',
        align: 'right',
        render: (row) => row.resultCount,
      },
    ];
  }, [result, year]);

  const evidenceColumns = useMemo<Array<DataColumn<StatisticsEvidence>>>(() => [
    {
      id: 'race',
      header: 'Race evidence',
      render: (row) => (
        <Link className="analysis-table-link" to={row.raceRoute}>
          <strong>R{row.round} · {row.grandPrix}</strong>
          <small>{row.team ?? 'Team unavailable'}</small>
        </Link>
      ),
    },
    {
      id: 'driver',
      header: 'Driver',
      render: (row) => (
        <Link to={`/${year}/drivers/${row.driverId}`}>{row.driver}</Link>
      ),
    },
    {
      id: 'quali',
      header: 'Qualifying',
      align: 'center',
      render: (row) => position(row.qualifying),
    },
    {
      id: 'grid',
      header: 'Grid',
      align: 'center',
      render: (row) => position(row.grid),
    },
    {
      id: 'finish',
      header: 'Finish',
      align: 'center',
      render: (row) => position(row.position),
    },
    {
      id: 'points',
      header: 'Points',
      align: 'right',
      render: (row) => row.points,
    },
    {
      id: 'status',
      header: 'Status',
      render: (row) => row.status,
    },
  ], [year]);

  const runQuestion = async (value = question) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const mentionedSeason = Number(trimmed.match(/\b(2025|2026)\b/)?.[1]);
    const nextYear = AVAILABLE_SEASONS.includes(mentionedSeason)
      ? mentionedSeason
      : year;
    const next = new URLSearchParams(searchParams);
    next.set('season', String(nextYear));
    next.set('q', trimmed);
    setSearchParams(next, { replace: true });
    autoRunKey.current = `${nextYear}:${trimmed}`;
    if (nextYear !== year) {
      pendingQuestion.current = trimmed;
      reset();
      setYear(nextYear);
      return;
    }
    await execute({ question: trimmed, season: nextYear });
  };

  const submitQuestion = (event: FormEvent) => {
    event.preventDefault();
    void runQuestion();
  };

  const useSuggestion = (suggestion: string) => {
    setQuestion(suggestion);
    void runQuestion(suggestion);
  };

  const updateSeason = (nextYear: number) => {
    const normalized = getSeasonFromParam(nextYear);
    const next = new URLSearchParams(searchParams);
    next.set('season', String(normalized));
    next.delete('q');
    setSearchParams(next, { replace: true });
    autoRunKey.current = '';
    setYear(normalized);
    setQuestion('');
    setEditorQuery(null);
    reset();
  };

  const runStructured = (event: FormEvent) => {
    event.preventDefault();
    if (!editorQuery) return;
    void execute({
      query: editorQuery,
      interpretationMode: 'structured',
    });
  };

  const updateEditor = (patch: Partial<StatisticsQuery>) => {
    setEditorQuery((current) => current ? { ...current, ...patch } : current);
  };

  const updateFilters = (patch: Partial<StatisticsQuery['filters']>) => {
    setEditorQuery((current) => current ? {
      ...current,
      filters: {
        ...current.filters,
        ...patch,
      },
    } : current);
  };

  const toggleDriver = (driverId: string) => {
    if (!editorQuery) return;
    const selected = editorQuery.filters.driverIds;
    const next = selected.includes(driverId)
      ? selected.filter((id) => id !== driverId)
      : selected.length < 6
        ? [...selected, driverId]
        : selected;
    updateFilters({ driverIds: next });
  };

  if (!envelope && directoryStatus === 'loading') {
    return <LoadingFrame label="Loading Ask Slipstream" />;
  }
  if (!envelope) {
    return (
      <CorePageState
        year={year}
        message={directoryError?.message}
        onRetry={retryDirectory}
      />
    );
  }

  return (
    <main className="core-page analysis-page ask-page">
      <CorePageHeader
        eyebrow={`Published statistics / season ${year}`}
        title="Ask Slipstream"
        description="Ask a driver-statistics question, inspect exactly how it was interpreted, and verify the answer against the published race rows."
        meta={envelope.meta}
      />

      <section className="ask-console" aria-labelledby="ask-console-title">
        <div className="ask-console__query">
          <span className="core-page__eyebrow">Deterministic statistics search</span>
          <h2 id="ask-console-title">What do you want to know?</h2>
          <form onSubmit={submitQuestion} role="search">
            <label htmlFor="ask-question">Driver statistics question</label>
            <div>
              <Search aria-hidden="true" size={20} />
              <input
                id="ask-question"
                maxLength={220}
                placeholder="Who has the best average finish since round 5?"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
              />
              <button disabled={!question.trim() || status === 'loading'} type="submit">
                {status === 'loading' ? 'Calculating…' : 'Calculate'}
              </button>
            </div>
          </form>
          <div className="ask-suggestions" aria-label="Suggested questions">
            {suggestedQuestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => useSuggestion(suggestion)}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>

        <aside className="ask-console__trust">
          <ShieldCheck aria-hidden="true" size={24} />
          <h3>Every answer is reproducible.</h3>
          <p>
            Questions become validated filters. Slipstream calculates the answer
            from published classifications and returns the rows that support it.
          </p>
          <dl>
            <div>
              <dt>Calculation</dt>
              <dd>Published data only</dd>
            </div>
            <div>
              <dt>Current sample</dt>
              <dd>Through R{envelope.data.throughRound}</dd>
            </div>
          </dl>
        </aside>
      </section>

      {status === 'error' && (
        <AnalysisState
          state="error"
          title="That query could not run"
          detail={error?.message ?? 'Review the question or structured filters and try again.'}
        />
      )}

      {result && editorQuery && (
        <>
          <section className="ask-interpretation">
            <header>
              <div>
                <span className="core-page__eyebrow">Interpreted query</span>
                <h2>You can edit every parameter.</h2>
              </div>
              <span className={`ask-mode is-${result.data.interpretation.mode}`}>
                <Calculator aria-hidden="true" size={13} />
                {result.data.interpretation.mode === 'structured'
                  ? 'Structured filters'
                  : 'Deterministic interpretation'}
              </span>
            </header>

            <form onSubmit={runStructured}>
              <FilterBar
                eyebrow="Validated parameters"
                title="Refine this query"
                actions={(
                  <button className="analysis-action-button" type="submit">
                    <Check aria-hidden="true" size={15} />
                    Apply filters
                  </button>
                )}
              >
                <FilterField label="Season">
                  <select
                    value={editorQuery.season}
                    onChange={(event) => updateSeason(Number(event.target.value))}
                  >
                    {AVAILABLE_SEASONS.map((season) => (
                      <option key={season} value={season}>{season}</option>
                    ))}
                  </select>
                </FilterField>
                <FilterField label="Metric">
                  <select
                    value={editorQuery.metrics[0]}
                    onChange={(event) => {
                      const selected = statisticsMetricOptions.find(
                        (option) => option.id === event.target.value,
                      );
                      if (!selected) return;
                      updateEditor({
                        metrics: [selected.id],
                        sort: [{
                          metric: selected.id,
                          direction: selected.direction,
                        }],
                      });
                    }}
                  >
                    {statisticsMetricOptions.map((option) => (
                      <option key={option.id} value={option.id}>{option.label}</option>
                    ))}
                  </select>
                </FilterField>
                <FilterField label="Team">
                  <select
                    value={editorQuery.filters.team ?? ''}
                    onChange={(event) => updateFilters({
                      team: event.target.value || null,
                    })}
                  >
                    <option value="">All teams</option>
                    {envelope.data.teams.map((team) => (
                      <option key={team} value={team}>{team}</option>
                    ))}
                  </select>
                </FilterField>
                <FilterField label="From round">
                  <input
                    max={99}
                    min={1}
                    type="number"
                    value={editorQuery.filters.roundFrom}
                    onChange={(event) => updateFilters({
                      roundFrom: Number(event.target.value),
                    })}
                  />
                </FilterField>
                <FilterField label="Through round">
                  <input
                    max={99}
                    min={1}
                    type="number"
                    value={editorQuery.filters.roundTo}
                    onChange={(event) => updateFilters({
                      roundTo: Number(event.target.value),
                    })}
                  />
                </FilterField>
                <FilterField label="Result limit">
                  <input
                    max={20}
                    min={1}
                    type="number"
                    value={editorQuery.limit}
                    onChange={(event) => updateEditor({
                      limit: Number(event.target.value),
                    })}
                  />
                </FilterField>
                <FilterField label="Ranking order">
                  <SegmentedControl
                    label="Ranking order"
                    options={[
                      { value: 'desc', label: 'Highest' },
                      { value: 'asc', label: 'Lowest' },
                    ]}
                    value={editorQuery.sort[0].direction}
                    onChange={(direction) => updateEditor({
                      sort: [{
                        metric: editorQuery.metrics[0],
                        direction,
                      }],
                    })}
                  />
                </FilterField>
              </FilterBar>

              <details className="ask-driver-filter">
                <summary>
                  Driver sample
                  <span>
                    {editorQuery.filters.driverIds.length
                      ? `${editorQuery.filters.driverIds.length} selected`
                      : 'Full field'}
                  </span>
                </summary>
                <div>
                  {envelope.data.drivers.map((driver) => (
                    <label key={driver.id}>
                      <input
                        checked={editorQuery.filters.driverIds.includes(driver.id)}
                        disabled={
                          !editorQuery.filters.driverIds.includes(driver.id)
                          && editorQuery.filters.driverIds.length >= 6
                        }
                        type="checkbox"
                        onChange={() => toggleDriver(driver.id)}
                      />
                      <span>{driver.name}</span>
                      <small>{driver.team}</small>
                    </label>
                  ))}
                </div>
              </details>
            </form>

            <ul>
              {result.data.interpretation.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </section>

          <section className="ask-answer" aria-labelledby="ask-answer-title">
            <div className="ask-answer__statement">
              <span className="core-page__eyebrow">Calculated answer</span>
              <h2 id="ask-answer-title">{result.data.answer.headline}</h2>
              <p>{result.data.answer.summary}</p>
            </div>
            <dl className="ask-answer__scope">
              <div>
                <dt>Exact scope</dt>
                <dd>{result.data.sample.label}</dd>
              </div>
              <div>
                <dt>Calculation</dt>
                <dd>{result.data.calculation.definition}</dd>
              </div>
              <div>
                <dt>Data timestamp</dt>
                <dd>
                  <time dateTime={result.meta.publishedAt}>
                    {new Date(result.meta.publishedAt ?? '').toLocaleString()}
                  </time>
                </dd>
              </div>
            </dl>
          </section>

          <section className="analysis-panel ask-ranking">
            <header className="analysis-panel__header">
              <div>
                <span className="core-page__eyebrow">Supporting result</span>
                <h2>{result.data.metric.label} ranking</h2>
              </div>
              <Link className="analysis-definition" to={result.data.calculation.methodologyRoute}>
                <BookOpen aria-hidden="true" size={13} />
                Read the calculation
              </Link>
            </header>
            <ResponsiveDataView
              columns={resultColumns}
              getKey={(row) => row.id}
              label={`${result.data.metric.label} query results`}
              rows={result.data.rows}
            />
          </section>

          <section className="ask-audit">
            <article>
              <Database aria-hidden="true" size={18} />
              <span className="core-page__eyebrow">Calculation audit</span>
              <h2>Scope, caveats, and source rows stay attached.</h2>
              <ul>
                {result.data.caveats.map((caveat) => (
                  <li key={caveat}>{caveat}</li>
                ))}
              </ul>
            </article>
            <nav aria-label="Related analysis">
              {result.data.relatedRoutes.map((route) => (
                <Link key={route.path} to={route.path}>
                  {route.label}
                  <ArrowUpRight aria-hidden="true" size={15} />
                </Link>
              ))}
            </nav>
          </section>

          <details className="ask-evidence">
            <summary>
              Supporting race rows
              <span>{result.data.evidence.length} visible records</span>
            </summary>
            <ResponsiveDataView
              columns={evidenceColumns}
              getKey={(row) => row.id}
              label="Race rows supporting this calculation"
              rows={result.data.evidence}
            />
          </details>
        </>
      )}
    </main>
  );
};

export default AskWorkspace;
