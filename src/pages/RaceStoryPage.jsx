import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CircleAlert,
  Flag,
  Gauge,
  GitCompareArrows,
  Route,
  ShieldCheck,
  TimerReset,
  TrafficCone,
  TrendingDown,
  TrendingUp,
  Wrench,
} from 'lucide-react';
import { useParams } from 'react-router-dom';
import DriverMark from '../components/DriverMark.jsx';
import TeamLogo from '../components/TeamLogo.jsx';
import { useSeasonData } from '../hooks/useSeasonData.js';
import {
  useRaceAnalytics,
  useSeasonRaceAnalytics,
} from '../hooks/useRaceStoryData.js';
import {
  DRIVER_CODE_NAMES_2026,
} from '../data/seasonGrid.js';
import { getTrackName } from '../utils/raceLabels.js';
import { getSeasonFromParam } from '../utils/seasons.js';
import './RaceStoryPage.css';

const formatNumber = (value, suffix = '') => (
  Number.isFinite(Number(value)) ? `${Number(value).toFixed(1).replace(/\.0$/, '')}${suffix}` : '—'
);

const formatDelta = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  if (number > 0) return `+${number}`;
  return String(number);
};

const formatCompound = (compound) => (
  compound ? compound.slice(0, 1).toUpperCase() : '?'
);

const compoundClass = (compound) => String(compound ?? 'unknown').toLowerCase();

const pluralizePlace = (count) => `${count} place${count === 1 ? '' : 's'}`;
const finiteNumber = (value) => {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const getPitCycleContext = (event, disruptionEvents, names) => {
  const disruption = disruptionEvents.find((candidate) => (
    Number.isFinite(candidate.lap)
    && candidate.lap === event.pit_lap
    && (
      candidate.phase === 'deployed'
      || /deployed|\bred flag\b/i.test(candidate.message ?? '')
    )
  ));
  const context = event.strategy_context
    ?? (disruption ? `${disruption.type}_window` : 'green_flag_stop');
  const rival = names.get(event.strategy_rival)
    ?? DRIVER_CODE_NAMES_2026[event.strategy_rival]
    ?? event.strategy_rival;
  const lapsBefore = finiteNumber(event.laps_before_rival);
  const lapWord = lapsBefore === 1 ? 'lap' : 'laps';

  if (context === 'safety_car_window') {
    return {
      label: 'Safety Car window',
      detail: 'The field was compressed, so this position swing is not equivalent to a normal green-flag stop cost.',
    };
  }
  if (context === 'virtual_safety_car_window') {
    return {
      label: 'VSC opportunity',
      detail: 'The stop came under a reduced-speed window, lowering the time penalty relative to green-flag running.',
    };
  }
  if (context === 'red_flag_window') {
    return {
      label: 'Red-flag window',
      detail: 'The race was neutralized, so the usual pit-cycle comparison does not fully describe the strategic cost.',
    };
  }
  if (context === 'undercut_success') {
    return {
      label: 'Undercut gain',
      detail: `Stopped ${lapsBefore} ${lapWord} before ${rival}; the timing and order reversal support a successful undercut.`,
    };
  }
  if (context === 'undercut_attempt') {
    return {
      label: 'Undercut attempt',
      detail: `Stopped ${lapsBefore} ${lapWord} before nearby ${rival}; the sequence is consistent with an undercut attempt.`,
    };
  }
  if (context === 'position_recovery') {
    return {
      label: 'Cycle recovery',
      detail: 'The immediate pit-exit drop was temporary as the surrounding stop sequence unfolded.',
    };
  }
  return {
    label: 'Green-flag stop',
    detail: 'Measured against the running order before the stop and again three laps later.',
  };
};

const getPitCyclePositionStory = (event) => {
  const before = finiteNumber(event.position_before);
  const exit = finiteNumber(event.position_on_exit);
  const after = finiteNumber(event.position_after_three_laps);
  const lostOnExit = finiteNumber(event.positions_lost_on_exit);
  const recovered = finiteNumber(event.positions_recovered_after_exit);

  if (exit != null) {
    if (lostOnExit > 0 && recovered > 0) {
      return `Dropped ${pluralizePlace(lostOnExit)} on exit, then recovered ${recovered} by L+3.`;
    }
    if (lostOnExit > 0) {
      return `Dropped ${pluralizePlace(lostOnExit)} on exit; none had returned by L+3.`;
    }
    if (recovered > 0) {
      return `Rejoined without losing a place, then gained ${recovered} more by L+3.`;
    }
    if (before != null && after != null && before === after) {
      return 'Held the same position through the measured pit cycle.';
    }
  }

  const delta = finiteNumber(event.position_delta);
  if (delta != null && delta !== 0) {
    return `${delta > 0 ? 'Gained' : 'Lost'} ${pluralizePlace(Math.abs(delta))} from the pre-stop order to L+3.`;
  }
  return 'No net position change was measured over the three-lap pit cycle.';
};

const DriverIdentity = ({
  code,
  team,
  names,
  year,
  reversed = false,
}) => {
  const name = names.get(code) ?? DRIVER_CODE_NAMES_2026[code] ?? code;

  return (
    <span className={`story-driver ${reversed ? 'reversed' : ''}`}>
      <span className="story-driver-marks">
        <DriverMark driver={name} size="sm" team={team} year={year} />
        <TeamLogo size="xs" team={team} tone="team" year={year} />
      </span>
      <span>
        <strong>{name}</strong>
        <small>{code} · {team}</small>
      </span>
    </span>
  );
};

const Metric = ({
  label,
  value,
  icon,
}) => (
  <div className="story-metric">
    {React.createElement(icon, { 'aria-hidden': true, size: 17 })}
    <span>{label}</span>
    <strong>{value}</strong>
  </div>
);

const getEventCopy = (event, names) => {
  const driver = names.get(event.driver) ?? DRIVER_CODE_NAMES_2026[event.driver] ?? event.driver;
  const opponent = names.get(event.opponent) ?? DRIVER_CODE_NAMES_2026[event.opponent] ?? event.opponent;

  if (event.type === 'overtake') {
    return `${driver} passed ${opponent} for P${event.to_position}`;
  }
  if (event.type === 'pit_cycle') {
    return `${driver} ${event.outcome === 'held' ? 'held position' : `${event.outcome} ${Math.abs(event.position_delta)} place${Math.abs(event.position_delta) === 1 ? '' : 's'}`} through the pit cycle`;
  }
  if (event.type === 'attrition') {
    return `${driver} retired from P${event.last_position ?? '—'}: ${event.status}`;
  }
  if (event.type === 'disruption') {
    return event.message ?? event.disruption_type?.replaceAll('_', ' ') ?? 'Race control interruption';
  }
  return 'Race event';
};

const StoryTimeline = ({ events, names }) => {
  const moments = useMemo(() => {
    const candidates = events.filter((event) => (
      event.type === 'disruption'
      || event.type === 'attrition'
      || (event.type === 'pit_cycle' && Math.abs(event.position_delta ?? 0) >= 2)
      || (event.type === 'overtake' && (event.positions_gained ?? 0) >= 2)
    ));
    const firstPass = events.find((event) => event.type === 'overtake' && event.retained_two_laps);
    if (firstPass) candidates.push(firstPass);

    const deduplicated = Array.from(candidates.reduce((map, event) => {
      const key = `${event.type}-${event.lap}-${event.driver ?? event.disruption_type}`;
      const existing = map.get(key);
      const score = event.type === 'disruption'
        ? 10
        : event.type === 'attrition'
          ? 8
          : Math.abs(event.position_delta ?? event.positions_gained ?? 1);
      const existingScore = existing
        ? Math.abs(existing.position_delta ?? existing.positions_gained ?? 1)
        : -1;
      if (!existing || score > existingScore) map.set(key, event);
      return map;
    }, new Map()).values());
    const maxLap = Math.max(1, ...deduplicated.map((event) => event.lap ?? 1));
    const phases = [[], [], [], []];

    deduplicated.forEach((event) => {
      const phase = Math.min(3, Math.floor((((event.lap ?? 1) - 1) / maxLap) * 4));
      phases[phase].push(event);
    });

    return phases
      .flatMap((phase) => phase
        .sort((a, b) => {
          const scoreA = a.type === 'disruption' ? 10 : a.type === 'attrition' ? 8 : Math.abs(a.position_delta ?? a.positions_gained ?? 1);
          const scoreB = b.type === 'disruption' ? 10 : b.type === 'attrition' ? 8 : Math.abs(b.position_delta ?? b.positions_gained ?? 1);
          return scoreB - scoreA || (a.lap ?? 999) - (b.lap ?? 999);
        })
        .slice(0, 3))
      .sort((a, b) => (a.lap ?? 999) - (b.lap ?? 999));
  }, [events]);

  if (moments.length === 0) return null;

  return (
    <div className="story-timeline">
      {moments.map((event) => (
        <div className={`story-moment ${event.type}`} key={`${event.type}-${event.id}`}>
          <span className="moment-lap">L{event.lap ?? '—'}</span>
          <span>{getEventCopy(event, names)}</span>
        </div>
      ))}
    </div>
  );
};

const CircuitTransferMap = ({
  races,
  selectedRound,
  onSelectRound,
}) => {
  const selected = races.find((race) => race.round === selectedRound);
  const dimensions = selected?.circuitProfile?.dimensions;

  const similarities = useMemo(() => {
    if (!dimensions) return [];
    const keys = ['passing', 'traffic', 'strategy', 'attrition', 'disruption'];

    return races
      .filter((race) => race.round !== selectedRound && race.circuitProfile?.dimensions)
      .map((race) => {
        const distance = Math.sqrt(keys.reduce((sum, key) => (
          sum + ((dimensions[key] ?? 0) - (race.circuitProfile.dimensions[key] ?? 0)) ** 2
        ), 0));
        return { ...race, similarity: Math.max(0, 100 - (distance / Math.sqrt(keys.length))) };
      })
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 3);
  }, [dimensions, races, selectedRound]);

  if (!dimensions) return null;
  const labelOffsets = {
    1: { x: 10, y: -15 },
    2: { x: 10, y: 17 },
    3: { x: 10, y: -10 },
    4: { x: -62, y: -11 },
    5: { x: -64, y: -13 },
    6: { x: 10, y: -10 },
    7: { x: -58, y: -10 },
    8: { x: 10, y: -9 },
    9: { x: 12, y: 19 },
  };

  return (
    <section className="story-section transfer-section">
      <div className="story-section-heading">
        <div>
          <span className="section-kicker">Circuit transfer map</span>
          <h2>Where this race shape travels</h2>
        </div>
        <Route aria-hidden="true" size={24} />
      </div>

      <div className="transfer-layout">
        <div className="transfer-map-wrap">
          <div className="transfer-axis-label y">Strategy pressure</div>
          <svg
            aria-label="Circuit similarity map"
            className="transfer-map"
            role="img"
            viewBox="0 0 620 280"
          >
            <path d="M52 22 V238 H594" className="map-axis" />
            {[25, 50, 75].map((tick) => (
              <g key={tick}>
                <path d={`M52 ${238 - (tick * 2.05)} H594`} className="map-gridline" />
                <path d={`M${52 + (tick * 5.35)} 22 V238`} className="map-gridline" />
              </g>
            ))}
            {races.filter((race) => race.circuitProfile?.dimensions).map((race) => {
              const profile = race.circuitProfile;
              const x = 52 + ((profile.dimensions.passing ?? 0) * 5.35);
              const pressure = (
                (profile.dimensions.strategy ?? 0)
                + (profile.dimensions.traffic ?? 0)
                + (profile.dimensions.disruption ?? 0)
              ) / 3;
              const y = 238 - (pressure * 2.05);
              const active = race.round === selectedRound;
              const labelOffset = labelOffsets[race.round] ?? { x: 10, y: -8 };

              return (
                <g
                  className={`circuit-point ${active ? 'active' : ''}`}
                  key={race.round}
                  onClick={() => onSelectRound(race.round)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') onSelectRound(race.round);
                  }}
                  role="button"
                  tabIndex="0"
                >
                  <circle cx={x} cy={y} r={active ? 9 : 6} />
                  <text x={x + labelOffset.x} y={y + labelOffset.y}>
                    {profile.location ?? `R${race.round}`}
                  </text>
                </g>
              );
            })}
          </svg>
          <div className="transfer-axis-label x">Passing intensity</div>
        </div>

        <div className="profile-panel">
          {Object.entries(dimensions).map(([key, value]) => (
            <div className="profile-dimension" key={key}>
              <span>{key}</span>
              <div><i style={{ width: `${value}%` }} /></div>
              <strong>{formatNumber(value)}</strong>
            </div>
          ))}

          <div className="closest-circuits">
            <span>Closest race shapes</span>
            {similarities.length > 0 ? similarities.map((race) => (
              <button key={race.round} onClick={() => onSelectRound(race.round)}>
                <span>{race.circuitProfile.location ?? `Round ${race.round}`}</span>
                <strong>{formatNumber(race.similarity, '%')}</strong>
              </button>
            )) : <small>More completed races will populate the comparison.</small>}
          </div>
        </div>
      </div>
    </section>
  );
};

const RaceStoryPage = () => {
  const { seasonYear } = useParams();
  const year = getSeasonFromParam(seasonYear);
  const { races: seasonRaces, status: seasonDataStatus } = useSeasonData(year);
  const { data: seasonAnalytics, status: seasonStatus } = useSeasonRaceAnalytics(year);
  const [selectedRound, setSelectedRound] = useState(null);
  const [roundTouched, setRoundTouched] = useState(false);
  const [overtakeFilter, setOvertakeFilter] = useState('all');
  const [driverFilter, setDriverFilter] = useState('all');
  const analyticsByRound = useMemo(() => new Map(
    (seasonAnalytics?.races ?? []).map((race) => [Number(race.round), race]),
  ), [seasonAnalytics]);
  const availableRaces = useMemo(
    () => {
      const racesByRound = new Map();

      seasonRaces.forEach((race) => {
        racesByRound.set(Number(race.round), {
          round: Number(race.round),
          circuitProfile: {
            event_name: race.grand_prix,
            location: getTrackName(race),
          },
          hasAnalytics: false,
        });
      });

      analyticsByRound.forEach((race, round) => {
        racesByRound.set(round, {
          ...race,
          hasAnalytics: true,
        });
      });

      return [...racesByRound.values()].sort((a, b) => a.round - b.round);
    },
    [analyticsByRound, seasonRaces],
  );
  const selectedHasAnalytics = analyticsByRound.has(Number(selectedRound));
  const { data: analytics, status: raceStatus } = useRaceAnalytics(
    year,
    selectedHasAnalytics ? selectedRound : null,
  );

  useEffect(() => {
    if (availableRaces.length === 0) return;
    if (!roundTouched || !availableRaces.some((race) => race.round === selectedRound)) {
      setSelectedRound(availableRaces.at(-1).round);
    }
  }, [availableRaces, roundTouched, selectedRound]);

  const selectedSeasonRace = seasonRaces.find((race) => Number(race.round) === selectedRound);
  const names = useMemo(() => {
    const map = new Map(Object.entries(DRIVER_CODE_NAMES_2026).map(([code, name]) => [code, name]));
    selectedSeasonRace?.race_results?.forEach((result) => {
      if (result.driver_code && result.driver) map.set(result.driver_code, result.driver);
    });
    return map;
  }, [selectedSeasonRace]);

  const teamByDriver = useMemo(() => new Map(
    (analytics?.drivers ?? []).map((driver) => [driver.driver, driver.team]),
  ), [analytics]);

  const filteredOvertakes = useMemo(() => (
    (analytics?.overtakeEvents ?? []).filter((event) => {
      if (overtakeFilter === 'retained' && !event.retained_two_laps) return false;
      if (overtakeFilter === 'unsettled' && event.retained_two_laps) return false;
      if (driverFilter !== 'all' && event.driver !== driverFilter && event.opponent !== driverFilter) return false;
      return true;
    })
  ), [analytics, driverFilter, overtakeFilter]);

  const trafficDrivers = useMemo(() => (
    [...(analytics?.drivers ?? [])]
      .filter((driver) => driver.traffic_exposure_laps > 0)
      .sort((a, b) => b.estimated_traffic_loss_seconds - a.estimated_traffic_loss_seconds)
  ), [analytics]);

  const pitCycleGroups = useMemo(() => {
    const groups = new Map();

    [...(analytics?.pitCycleEvents ?? [])]
      .sort((a, b) => (
        Number(a.pit_lap) - Number(b.pit_lap)
        || Number(a.position_before ?? 99) - Number(b.position_before ?? 99)
      ))
      .forEach((event) => {
        const lap = Number(event.pit_lap);
        const events = groups.get(lap) ?? [];
        events.push(event);
        groups.set(lap, events);
      });

    return Array.from(groups, ([lap, events]) => ({ lap, events }));
  }, [analytics]);

  const raceLabel = analytics?.circuitProfile?.event_name
    ?? selectedSeasonRace?.grand_prix
    ?? `Round ${selectedRound ?? '—'}`;
  const selectedRaceOption = availableRaces.find((race) => race.round === selectedRound);

  const raceSelect = (
    <label className="race-story-select">
      <span>Race</span>
      <select
        onChange={(event) => {
          setRoundTouched(true);
          setSelectedRound(Number(event.target.value));
        }}
        value={selectedRound ?? ''}
      >
        {availableRaces.map((race) => (
          <option key={race.round} value={race.round}>
            R{race.round} · {race.circuitProfile?.location ?? race.session?.event_name ?? 'Race'}
            {!race.hasAnalytics ? ' · timing pending' : ''}
          </option>
        ))}
      </select>
    </label>
  );

  if (
    (seasonDataStatus === 'loading' && seasonRaces.length === 0)
    || (seasonStatus === 'loading' && availableRaces.length === 0)
    || !selectedRound
    || (selectedHasAnalytics && (raceStatus === 'idle' || raceStatus === 'loading'))
  ) {
    return <main className="race-story-page"><div className="story-state">Building the race story…</div></main>;
  }

  if (availableRaces.length === 0) {
    return (
      <main className="race-story-page">
        <div className="story-state error">
          <CircleAlert size={24} />
          <strong>No race story is available for this season yet.</strong>
        </div>
      </main>
    );
  }

  if (!selectedHasAnalytics || raceStatus === 'error') {
    return (
      <main className="race-story-page">
        <header className="race-story-header">
          <div>
            <span className="section-kicker">Race story</span>
            <h1>{raceLabel}</h1>
            <p>
              Round {selectedRound}
              {selectedRaceOption?.circuitProfile?.location ? ` · ${selectedRaceOption.circuitProfile.location}` : ''}
            </p>
          </div>
          {raceSelect}
        </header>

        <div className="story-state">
          <CircleAlert size={24} />
          <strong>Detailed race story timing is pending for this race.</strong>
          <p>
            The completed race results are published, but FastF1 timing data for the story view is not available yet.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="race-story-page">
      <header className="race-story-header">
        <div>
          <span className="section-kicker">Race story</span>
          <h1>{raceLabel}</h1>
          <p>
            Round {selectedRound}
            {analytics?.circuitProfile?.location ? ` · ${analytics.circuitProfile.location}` : ''}
          </p>
        </div>
        {raceSelect}
      </header>

      <div className="story-metrics">
        <Metric icon={GitCompareArrows} label="On-track passes" value={analytics.summary?.estimated_true_overtakes ?? 0} />
        <Metric icon={ShieldCheck} label="Retained" value={analytics.summary?.retained_overtakes ?? 0} />
        <Metric icon={TrafficCone} label="Traffic laps" value={analytics.summary?.traffic_exposure_laps ?? 0} />
        <Metric icon={Gauge} label="Opportunity conversion" value={formatNumber(analytics.summary?.opportunity_conversion_pct, '%')} />
        <Metric icon={Wrench} label="Pit cycles" value={analytics.summary?.pit_cycles ?? 0} />
        <Metric icon={Flag} label="Attrition" value={analytics.summary?.attrition_events ?? 0} />
      </div>

      <section className="story-section">
        <div className="story-section-heading">
          <div>
            <span className="section-kicker">Race flow</span>
            <h2>The moments that changed its shape</h2>
          </div>
          <TimerReset aria-hidden="true" size={24} />
        </div>
        <StoryTimeline events={analytics.storyEvents ?? []} names={names} />
      </section>

      <section className="story-section overtake-section">
        <div className="story-section-heading">
          <div>
            <span className="section-kicker">Overtake timeline</span>
            <h2>Every identified on-track pass</h2>
          </div>
          <span className="section-count">{filteredOvertakes.length}</span>
        </div>

        <div className="overtake-controls">
          <div className="segmented-control" aria-label="Overtake status">
            {['all', 'retained', 'unsettled'].map((filter) => (
              <button
                className={overtakeFilter === filter ? 'active' : ''}
                key={filter}
                onClick={() => setOvertakeFilter(filter)}
              >
                {filter}
              </button>
            ))}
          </div>
          <select onChange={(event) => setDriverFilter(event.target.value)} value={driverFilter}>
            <option value="all">All drivers</option>
            {(analytics.drivers ?? []).map((driver) => (
              <option key={driver.driver} value={driver.driver}>
                {names.get(driver.driver) ?? driver.driver}
              </option>
            ))}
          </select>
        </div>

        <div className="story-table-wrap">
          <table className="story-table overtake-table">
            <thead>
              <tr>
                <th>Lap</th>
                <th>Attack</th>
                <th aria-label="passed" />
                <th>Defence</th>
                <th>Position</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {filteredOvertakes.map((event) => (
                <tr key={event.id}>
                  <td className="lap-cell">L{event.lap}</td>
                  <td><DriverIdentity code={event.driver} names={names} team={event.driver_team ?? teamByDriver.get(event.driver)} year={year} /></td>
                  <td><ArrowRight aria-hidden="true" size={16} /></td>
                  <td><DriverIdentity code={event.opponent} names={names} team={event.opponent_team ?? teamByDriver.get(event.opponent)} year={year} /></td>
                  <td>P{event.from_position} → P{event.to_position}</td>
                  <td>
                    <span className={`event-status ${event.retained_two_laps ? 'retained' : 'unsettled'}`}>
                      {event.retained_two_laps ? 'Retained' : 'Reversed'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="story-section">
        <div className="story-section-heading">
          <div>
            <span className="section-kicker">Traffic tags & opportunity conversion</span>
            <h2>Who spent the race looking at a rear wing</h2>
          </div>
          <TrafficCone aria-hidden="true" size={24} />
        </div>

        <div className="traffic-grid">
          {trafficDrivers.slice(0, 10).map((driver) => (
              <article className="traffic-driver" key={driver.driver}>
                <div className="traffic-driver-name">
                  <DriverMark
                    driver={names.get(driver.driver) ?? driver.driver}
                    size="sm"
                    team={driver.team}
                    year={year}
                  />
                  <TeamLogo size="sm" team={driver.team} tone="team" year={year} />
                  <span className="traffic-driver-copy">
                    <strong>{names.get(driver.driver) ?? driver.driver}</strong>
                    <small>{driver.team}</small>
                  </span>
                </div>
                <div><span>Traffic</span><strong>{driver.traffic_exposure_laps} laps</strong></div>
                <div><span>Estimated loss</span><strong>{formatNumber(driver.estimated_traffic_loss_seconds, 's')}</strong></div>
                <div><span>Conversion</span><strong>{formatNumber(driver.opportunity_conversion_pct, '%')}</strong></div>
                <div className="traffic-tags">
                  {(driver.traffic_segments ?? []).slice(0, 4).map((segment) => (
                    <span className={segment.tag} key={segment.id}>
                      {segment.tag.replace('_', ' ')} · L{segment.start_lap}–{segment.end_lap}
                    </span>
                  ))}
                </div>
              </article>
          ))}
        </div>
      </section>

      <section className="story-section">
        <div className="story-section-heading">
          <div>
            <span className="section-kicker">Pit-cycle timeline</span>
            <h2>How each stop reshaped the order</h2>
          </div>
          <Wrench aria-hidden="true" size={24} />
        </div>

        <div className="pit-cycle-timeline">
          {pitCycleGroups.map((group) => (
            <div className="pit-cycle-group" key={group.lap}>
              <div className="pit-cycle-lap">
                <span>Lap</span>
                <strong>{group.lap}</strong>
              </div>
              <div className="pit-cycle-events">
                {group.events.map((event) => {
                  const context = getPitCycleContext(
                    event,
                    analytics.disruptionEvents ?? [],
                    names,
                  );
                  const contextClass = event.strategy_context ?? {
                    'Safety Car window': 'safety_car_window',
                    'VSC opportunity': 'virtual_safety_car_window',
                    'Red-flag window': 'red_flag_window',
                  }[context.label] ?? 'green_flag_stop';

                  return (
                    <article className="pit-cycle-event" key={event.id}>
                      <div className="pit-cycle-driver">
                        <DriverIdentity
                          code={event.driver}
                          names={names}
                          team={event.team}
                          year={year}
                        />
                        <div className="pit-cycle-stop">
                          <span>Stop {event.stop}</span>
                          <div aria-label={`${event.compound_before ?? 'Unknown'} to ${event.compound_after ?? 'unknown'} tyres`}>
                            <span className={`tyre-chip ${compoundClass(event.compound_before)}`}>
                              {formatCompound(event.compound_before)}
                            </span>
                            <ArrowRight aria-hidden="true" size={13} />
                            <span className={`tyre-chip ${compoundClass(event.compound_after)}`}>
                              {formatCompound(event.compound_after)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="pit-cycle-order">
                        <div>
                          <span>Before</span>
                          <strong>P{event.position_before ?? '—'}</strong>
                        </div>
                        <ArrowRight aria-hidden="true" size={15} />
                        <div>
                          <span>Pit exit</span>
                          <strong>P{event.position_on_exit ?? '—'}</strong>
                        </div>
                        <ArrowRight aria-hidden="true" size={15} />
                        <div>
                          <span>L+3</span>
                          <strong>P{event.position_after_three_laps ?? '—'}</strong>
                        </div>
                        <span className={`position-delta ${event.outcome}`}>
                          {event.position_delta > 0 ? <TrendingUp size={14} /> : event.position_delta < 0 ? <TrendingDown size={14} /> : null}
                          Net {formatDelta(event.position_delta)}
                        </span>
                      </div>

                      <div className="pit-cycle-context">
                        <span className={`strategy-context ${contextClass}`}>
                          {context.label}
                        </span>
                        <strong>{getPitCyclePositionStory(event)}</strong>
                        <small>{context.detail}</small>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          ))}
          {pitCycleGroups.length === 0 && (
            <p className="quiet-state">No classified pit cycles are available for this race.</p>
          )}
        </div>
      </section>

      <section className="story-section">
        <div className="story-section-heading">
          <div>
            <span className="section-kicker">Attrition & disruption</span>
            <h2>The places the race removed</h2>
          </div>
          <Flag aria-hidden="true" size={24} />
        </div>

        <div className="attrition-layout">
          <div className="attrition-list">
            {(analytics.attritionEvents ?? []).length > 0 ? analytics.attritionEvents.map((event) => (
              <div className="attrition-event" key={event.id}>
                <span>L{event.lap}</span>
                <DriverIdentity code={event.driver} names={names} team={event.team} />
                <strong>P{event.last_position ?? '—'}</strong>
                <small>{event.status}</small>
              </div>
            )) : <p className="quiet-state">No classified attrition events.</p>}
          </div>
          <div className="attrition-beneficiaries">
            <span>Attrition beneficiaries</span>
            {(analytics.drivers ?? [])
              .filter((driver) => driver.attrition_places_gained > 0)
              .sort((a, b) => b.attrition_places_gained - a.attrition_places_gained)
              .slice(0, 8)
              .map((driver) => (
                <div key={driver.driver}>
                  <span>{names.get(driver.driver) ?? driver.driver}</span>
                  <strong>+{driver.attrition_places_gained}</strong>
                </div>
              ))}
            {(analytics.drivers ?? []).every((driver) => driver.attrition_places_gained === 0) && (
              <small className="quiet-state">No driver inherited a classified place through attrition.</small>
            )}
          </div>
        </div>
      </section>

      <CircuitTransferMap
        onSelectRound={setSelectedRound}
        races={availableRaces}
        selectedRound={selectedRound}
      />
    </main>
  );
};

export default RaceStoryPage;
