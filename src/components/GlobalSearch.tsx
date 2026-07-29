import {
  ArrowRight,
  Command,
  Search,
  X,
} from 'lucide-react';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { getAnalysisData } from '../data/analysisData';
import { getCoreData } from '../data/coreData';
import './GlobalSearch.css';

interface GlobalSearchProps {
  activeSeason: number;
}

interface SearchEntry {
  id: string;
  label: string;
  detail: string;
  group: 'Explore' | 'Races' | 'Drivers' | 'Teams';
  path: string;
  keywords: string;
}

const navigationEntries = (year: number): SearchEntry[] => [
  {
    id: 'season',
    label: `${year} season desk`,
    detail: 'Championship overview and publication coverage',
    group: 'Explore',
    path: `/${year}`,
    keywords: 'home overview standings latest',
  },
  {
    id: 'races',
    label: 'Race dossiers',
    detail: 'Results, story events, strategy, and race analysis',
    group: 'Explore',
    path: `/${year}/races`,
    keywords: 'archive story grand prix analysis',
  },
  {
    id: 'drivers',
    label: 'Driver directory',
    detail: 'Season form, profiles, and teammate context',
    group: 'Explore',
    path: `/${year}/drivers`,
    keywords: 'standings profiles statistics',
  },
  {
    id: 'teams',
    label: 'Constructor standings',
    detail: 'Team points and driver contributions',
    group: 'Explore',
    path: `/${year}/standings/constructors`,
    keywords: 'teams constructors championship',
  },
  {
    id: 'results',
    label: 'Season results matrix',
    detail: 'Every driver and race in one field scan',
    group: 'Explore',
    path: `/${year}/results`,
    keywords: 'finish points grid status matrix',
  },
  {
    id: 'compare',
    label: 'Driver comparison',
    detail: 'Head-to-head season evidence',
    group: 'Explore',
    path: `/${year}/compare`,
    keywords: 'versus h2h metrics',
  },
  {
    id: 'pace',
    label: 'Pace Lab',
    detail: 'Lap and sector timing comparison',
    group: 'Explore',
    path: `/${year}/pace`,
    keywords: 'fastest slowest timing sectors slipstream recorder',
  },
  {
    id: 'pit-lane',
    label: 'Pit Lane',
    detail: 'Service, lane, and transit performance',
    group: 'Explore',
    path: `/${year}/pit-lane`,
    keywords: 'pit stops strategy service median',
  },
  {
    id: 'methodology',
    label: 'Methodology',
    detail: 'Sources, definitions, and publication rules',
    group: 'Explore',
    path: '/methodology',
    keywords: 'about definitions sources data',
  },
];

const normalize = (value: string) => value.toLocaleLowerCase().trim();

const GlobalSearch = ({ activeSeason }: GlobalSearchProps) => {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [dynamicEntries, setDynamicEntries] = useState<SearchEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.matches('input, textarea, select, [contenteditable="true"]');
      if (
        (event.key === '/' && !isTyping)
        || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k')
      ) {
        event.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener('keydown', handleShortcut);
    return () => document.removeEventListener('keydown', handleShortcut);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const controller = new AbortController();
    setLoading(true);
    setDynamicEntries([]);
    setQuery('');
    setActiveIndex(0);
    window.requestAnimationFrame(() => inputRef.current?.focus());

    Promise.allSettled([
      getCoreData(activeSeason, 'races', controller.signal),
      getAnalysisData(activeSeason, 'drivers', controller.signal),
    ]).then(([raceResult, driverResult]) => {
      if (controller.signal.aborted) return;
      const entries: SearchEntry[] = [];
      if (raceResult.status === 'fulfilled') {
        raceResult.value.data.races.forEach((race) => {
          entries.push({
            id: `race-${race.round}`,
            label: race.grandPrix,
            detail: `Round ${race.round} · ${race.storyReady ? 'Story ready' : 'Results ready'}`,
            group: 'Races',
            path: `/${activeSeason}/races/${race.round}`,
            keywords: `${race.circuit ?? ''} ${race.winner?.driver ?? ''} round ${race.round}`,
          });
        });
      }
      if (driverResult.status === 'fulfilled') {
        driverResult.value.data.drivers.forEach((driver) => {
          entries.push({
            id: `driver-${driver.id}`,
            label: driver.name,
            detail: `${driver.team ?? 'Independent'} · P${driver.rank} · ${driver.points} pts`,
            group: 'Drivers',
            path: `/${activeSeason}/drivers/${driver.id}`,
            keywords: `${driver.code ?? ''} ${driver.team ?? ''} driver`,
          });
        });
        driverResult.value.data.teams.forEach((team) => {
          entries.push({
            id: `team-${team}`,
            label: team,
            detail: 'Open constructor standings',
            group: 'Teams',
            path: `/${activeSeason}/standings/constructors`,
            keywords: 'team constructor standings',
          });
        });
      }
      setDynamicEntries(entries);
      setLoading(false);
    });

    return () => controller.abort();
  }, [activeSeason, open]);

  useEffect(() => {
    if (!open) return undefined;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.body.dataset.searchOpen = 'true';
    document.addEventListener('keydown', handleEscape);
    return () => {
      delete document.body.dataset.searchOpen;
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  const results = useMemo(() => {
    const needle = normalize(query);
    const entries = [...navigationEntries(activeSeason), ...dynamicEntries];
    if (!needle) return entries.slice(0, 9);
    const terms = needle.split(/\s+/);
    return entries.filter((entry) => {
      const haystack = normalize(`${entry.label} ${entry.detail} ${entry.keywords} ${entry.group}`);
      return terms.every((term) => haystack.includes(term));
    }).slice(0, 12);
  }, [activeSeason, dynamicEntries, query]);

  useEffect(() => {
    setActiveIndex((index) => Math.min(index, Math.max(0, results.length - 1)));
  }, [results.length]);

  const choose = (entry: SearchEntry) => {
    setOpen(false);
    navigate(entry.path);
  };

  return (
    <>
      <button
        className="slip-search-trigger"
        type="button"
        aria-label="Search Slipstream"
        onClick={() => setOpen(true)}
      >
        <Search aria-hidden="true" size={16} />
        <span>Search</span>
        <kbd>/</kbd>
      </button>

      {open && (
        <div
          className="slip-search"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <section
            className="slip-search__dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Search Slipstream"
          >
            <div className="slip-search__input">
              <Search aria-hidden="true" size={19} />
              <input
                ref={inputRef}
                type="search"
                value={query}
                placeholder="Search races, drivers, teams, or tools…"
                aria-label="Search"
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActiveIndex(0);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowDown') {
                    event.preventDefault();
                    if (results.length) {
                      setActiveIndex((index) => Math.min(index + 1, results.length - 1));
                    }
                  }
                  if (event.key === 'ArrowUp') {
                    event.preventDefault();
                    setActiveIndex((index) => Math.max(index - 1, 0));
                  }
                  if (event.key === 'Enter' && results[activeIndex]) {
                    event.preventDefault();
                    choose(results[activeIndex]);
                  }
                }}
              />
              <button type="button" aria-label="Close search" onClick={() => setOpen(false)}>
                <X aria-hidden="true" size={18} />
              </button>
            </div>

            <div className="slip-search__results" role="listbox" aria-label="Search results">
              {results.map((entry, index) => (
                <button
                  className={index === activeIndex ? 'is-active' : ''}
                  type="button"
                  role="option"
                  aria-selected={index === activeIndex}
                  key={`${entry.group}-${entry.id}`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => choose(entry)}
                >
                  <span>
                    <small>{entry.group}</small>
                    <strong>{entry.label}</strong>
                    <em>{entry.detail}</em>
                  </span>
                  <ArrowRight aria-hidden="true" size={17} />
                </button>
              ))}
              {!results.length && !loading && (
                <p>No matching page, race, driver, or team.</p>
              )}
              {loading && !dynamicEntries.length && (
                <p>Loading race and driver index…</p>
              )}
            </div>

            <footer>
              <span><Command aria-hidden="true" size={13} /> K to open</span>
              <span>↑ ↓ move</span>
              <span>↵ open</span>
              <span>esc close</span>
            </footer>
          </section>
        </div>
      )}
    </>
  );
};

export default GlobalSearch;
