// src/components/ChartComponents.jsx
import React from 'react';
import { Line, Bar, Scatter } from 'react-chartjs-2';
import { RotateCcw, X } from 'lucide-react';
import { getTeamColor } from '../utils/dataProcessing.js';
import {
  getLatestConstructorStandings,
  getLatestDriverStandings,
} from '../utils/constructorRace.js';
import DriverBrandLogo from './DriverBrandLogo.jsx';
import TeamCarMark from './TeamCarMark.jsx';
import TeamLogo from './TeamLogo.jsx';

const formatPointTotal = (value) => (
  `${value} ${Number(value) === 1 ? 'point' : 'points'}`
);

// Generic responsive chart wrapper
export const ResponsiveChart = ({ 
  type = 'line', 
  data, 
  options, 
  className = '',
  style = {},
  loading = false,
  error = null,
  onRetry = null 
}) => {
  const ChartComponent = {
    line: Line,
    bar: Bar,
    scatter: Scatter
  }[type];

  if (loading) {
    return (
      <div className={`chart-loading ${className}`} style={style}>
        <div className="loading-spinner"></div>
        <p>Loading chart...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`chart-error ${className}`} style={style}>
        <p>Error loading chart: {error}</p>
        {onRetry && (
          <button onClick={onRetry} className="retry-button">
            Retry
          </button>
        )}
      </div>
    );
  }

  if (!data || !ChartComponent) {
    return (
      <div className={`chart-placeholder ${className}`} style={style}>
        <p>No chart data available</p>
      </div>
    );
  }

  return (
    <div className={`chart-wrapper ${className} fade-in`} style={style}>
      <ChartComponent data={data} options={options} />
    </div>
  );
};

const RaceStageChart = ({
  data,
  options,
  standings,
  pluginId,
  className = '',
  style = {},
  isMobile = false,
  desktopCarWidth = 78,
  mobileCarWidth = 48,
  desktopMaxStagger = 132,
  mobileMaxStagger = 56,
  desktopStaggerRatio = 0.16,
  mobileStaggerRatio = 0.22,
  kind = 'constructor',
  seasonYear = 2026,
}) => {
  const chartRef = React.useRef(null);
  const [raceLayout, setRaceLayout] = React.useState(null);
  const [hoveredCarKey, setHoveredCarKey] = React.useState(null);
  const [pinnedCarKey, setPinnedCarKey] = React.useState(null);

  const syncRaceLayout = React.useCallback((chart = chartRef.current) => {
    const yScale = chart?.scales?.y;
    const chartArea = chart?.chartArea;
    if (!yScale || !chartArea || standings.length === 0) return;

    const canvasOffsetLeft = chart.canvas?.offsetLeft ?? 0;
    const canvasOffsetTop = chart.canvas?.offsetTop ?? 0;
    const carWidth = isMobile ? mobileCarWidth : desktopCarWidth;
    const carHeight = carWidth * (70 / 224);
    const finishX = canvasOffsetLeft + chartArea.right - (isMobile ? 4 : 8);
    const availableStagger = Math.min(
      chartArea.width * (isMobile ? mobileStaggerRatio : desktopStaggerRatio),
      isMobile ? mobileMaxStagger : desktopMaxStagger,
    );
    const staggerStep = standings.length > 1
      ? availableStagger / (standings.length - 1)
      : 0;

    const nextLayout = {
      finishX,
      cars: standings.map((standing, index) => ({
        ...standing,
        width: carWidth,
        left: finishX - carWidth - (index * staggerStep),
        top: canvasOffsetTop + yScale.getPixelForValue(standing.position) - (carHeight / 2),
        tooltipPlacement: yScale.getPixelForValue(standing.position) < chartArea.top + 118
          ? 'below'
          : 'above',
      })),
    };
    const signature = JSON.stringify(nextLayout);

    setRaceLayout((current) => (
      current?.signature === signature
        ? current
        : { ...nextLayout, signature }
    ));
  }, [
    desktopCarWidth,
    desktopMaxStagger,
    desktopStaggerRatio,
    isMobile,
    mobileCarWidth,
    mobileMaxStagger,
    mobileStaggerRatio,
    standings,
  ]);

  const raceGridPlugin = React.useMemo(() => ({
    id: pluginId,
    afterRender: syncRaceLayout,
    resize: syncRaceLayout,
  }), [pluginId, syncRaceLayout]);

  React.useEffect(() => {
    const frame = window.requestAnimationFrame(() => syncRaceLayout());
    return () => window.cancelAnimationFrame(frame);
  }, [syncRaceLayout]);

  const raceOptions = React.useMemo(() => ({
    ...options,
    plugins: {
      ...options?.plugins,
      legend: {
        ...options?.plugins?.legend,
        display: false,
      },
    },
  }), [options]);
  const activeCarKey = hoveredCarKey || pinnedCarKey;
  const latestRound = data?.labels?.at(-1);
  const getStandingPosition = React.useCallback(
    (car) => (kind === 'driver' ? car.championshipPosition : car.position),
    [kind],
  );
  const getGapFacts = React.useCallback((car) => {
    const standingPosition = getStandingPosition(car);
    if (standingPosition === 1) {
      return Number.isFinite(car.leadOverNext)
        ? [`Lead over P2: ${formatPointTotal(car.leadOverNext)}`]
        : [];
    }

    return [
      Number.isFinite(car.gapToLeader)
        ? `Gap to P1: ${formatPointTotal(car.gapToLeader)}`
        : null,
      standingPosition > 2 && Number.isFinite(car.gapToAhead)
        ? `Gap to P${standingPosition - 1}: ${formatPointTotal(car.gapToAhead)}`
        : null,
    ].filter(Boolean);
  }, [getStandingPosition]);

  const getCarSummary = React.useCallback((car) => {
    if (kind === 'driver') {
      return [
        car.label,
        `P${car.championshipPosition}`,
        formatPointTotal(car.points),
        car.team,
        ...getGapFacts(car),
        latestRound,
      ].filter(Boolean).join(', ');
    }

    return [
      car.label,
      `P${car.position}`,
      Number.isFinite(car.points) ? formatPointTotal(car.points) : null,
      ...getGapFacts(car),
      latestRound,
    ].filter(Boolean).join(', ');
  }, [getGapFacts, kind, latestRound]);

  return (
    <div className={`chart-wrapper race-stage-chart ${className} fade-in`} style={style}>
      <Line
        ref={chartRef}
        data={data}
        options={raceOptions}
        plugins={[raceGridPlugin]}
      />

      {raceLayout && (
        <div className="race-car-overlay">
          {raceLayout.cars.map((car) => {
            const isActive = activeCarKey === car.key;
            const tooltipId = `${pluginId}-${String(car.key).replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-details`;
            const standingPosition = getStandingPosition(car);
            const gapFacts = getGapFacts(car);

            return (
              <button
                aria-describedby={isActive ? tooltipId : undefined}
                aria-expanded={isActive}
                aria-label={getCarSummary(car)}
                className={`race-stage-car ${isActive ? 'is-active' : ''}`}
                key={car.key}
                onBlur={() => setHoveredCarKey(null)}
                onClick={() => setPinnedCarKey((current) => (
                  current === car.key ? null : car.key
                ))}
                onFocus={() => setHoveredCarKey(car.key)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    setHoveredCarKey(null);
                    setPinnedCarKey(null);
                    event.currentTarget.blur();
                  } else if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setHoveredCarKey(car.key);
                    setPinnedCarKey((current) => (
                      current === car.key ? null : car.key
                    ));
                  }
                }}
                onMouseEnter={() => setHoveredCarKey(car.key)}
                onMouseLeave={() => setHoveredCarKey(null)}
                onPointerEnter={() => setHoveredCarKey(car.key)}
                onPointerLeave={() => setHoveredCarKey(null)}
                style={{
                  left: `${car.left}px`,
                  top: `${car.top}px`,
                  width: `${car.width}px`,
                }}
                type="button"
              >
                <span className={`race-car-end-label race-car-end-label--${kind}`}>
                  <span className="race-car-end-label__position">P{standingPosition}</span>
                  {kind === 'driver' ? (
                    <span className="race-car-end-label__marks">
                      <DriverBrandLogo
                        driver={car.label}
                        size="xs"
                        team={car.team}
                        year={seasonYear}
                      />
                      <TeamLogo
                        size="xs"
                        team={car.team}
                        tone="team"
                        year={seasonYear}
                      />
                    </span>
                  ) : (
                    <TeamLogo
                      size="xs"
                      team={car.label}
                      tone="team"
                      year={seasonYear}
                    />
                  )}
                </span>
                <TeamCarMark compact team={car.teamKey} year={seasonYear} />

                <span
                  className={`race-car-tooltip race-car-tooltip--${car.tooltipPlacement}`}
                  id={tooltipId}
                  role="tooltip"
                >
                  <span className="race-car-tooltip__header">
                    {kind === 'driver' ? (
                      <span className="race-car-tooltip__marks">
                        <DriverBrandLogo
                          driver={car.label}
                          size="sm"
                          team={car.team}
                          year={seasonYear}
                        />
                        <TeamLogo
                          size="xs"
                          team={car.team}
                          tone="team"
                          year={seasonYear}
                        />
                      </span>
                    ) : (
                      <TeamLogo
                        size="sm"
                        team={car.label}
                        tone="team"
                        year={seasonYear}
                      />
                    )}
                    <span>
                      <strong>{car.label}</strong>
                      {kind === 'driver' && <small>{car.team}</small>}
                    </span>
                  </span>
                  <span className="race-car-tooltip__stats">
                    <span>
                      <small>Standing</small>
                      <strong>P{standingPosition}</strong>
                    </span>
                    <span>
                      <small>Points</small>
                      <strong>{Number.isFinite(car.points) ? car.points : '--'}</strong>
                    </span>
                  </span>
                  <span className="race-car-tooltip__gaps">
                    {gapFacts.map((fact) => <span key={fact}>{fact}</span>)}
                  </span>
                  {latestRound && (
                    <span className="race-car-tooltip__round">After {latestRound}</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const ConstructorRaceChart = (props) => {
  const standings = React.useMemo(
    () => getLatestConstructorStandings(props.data).map((standing) => ({
      ...standing,
      key: standing.teamKey,
    })),
    [props.data],
  );

  return (
    <RaceStageChart
      {...props}
      standings={standings}
      pluginId="constructor-race-grid"
      kind="constructor"
    />
  );
};

export const DriverRaceChart = ({
  selectedDrivers = [],
  ...props
}) => {
  const standings = React.useMemo(() => {
    const latestStandings = getLatestDriverStandings(props.data);
    const featuredDrivers = selectedDrivers.length > 0
      ? latestStandings.filter(({ label }) => selectedDrivers.includes(label))
      : latestStandings.slice(0, 5);

    return featuredDrivers.map((standing) => ({
      ...standing,
      key: standing.label,
      position: standing.points,
    }));
  }, [props.data, selectedDrivers]);

  return (
    <RaceStageChart
      {...props}
      standings={standings}
      pluginId="driver-race-grid"
      kind="driver"
      desktopCarWidth={62}
      mobileCarWidth={42}
      desktopMaxStagger={76}
      mobileMaxStagger={36}
      desktopStaggerRatio={0.1}
      mobileStaggerRatio={0.14}
    />
  );
};

export const SeasonDataState = ({
  status,
  error,
  onRetry,
  hasData = false,
}) => {
  if (hasData) return null;

  if (status === 'loading') {
    return (
      <div className="season-data-state" role="status">
        <div className="loading-spinner" aria-hidden="true"></div>
        <p>Loading season data...</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="season-data-state error" role="alert">
        <h2>Season data is temporarily unavailable</h2>
        <p>{error?.message || 'The data request did not complete.'}</p>
        {onRetry && (
          <button type="button" onClick={onRetry} className="retry-button">
            Try again
          </button>
        )}
      </div>
    );
  }

  return null;
};

// F1-specific driver selector component
export const DriverSelector = ({ 
  drivers = [],
  selectedDrivers = [],
  onDriverSelect,
  maxDrivers = 2,
  title = "Select Drivers to Compare",
  teamByDriver = new Map(),
  seasonYear = 2026,
}) => {
  const getDriverTeam = (driver) => (
    teamByDriver instanceof Map ? teamByDriver.get(driver) : teamByDriver[driver]
  );

  const selectionIsFull = selectedDrivers.length >= maxDrivers;
  const selectionLabel = selectedDrivers.length > 0
    ? `${selectedDrivers.length} of ${maxDrivers}`
    : `Top ${Math.min(maxDrivers, drivers.length)}`;

  return (
    <div className="driver-selector championship-driver-filter">
      <div className="championship-driver-filter__header">
        <span>
          <small>{title}</small>
          <strong>{selectionLabel}</strong>
        </span>
        {selectedDrivers.length > 0 && (
          <button
            aria-label="Reset driver filter"
            className="championship-driver-filter__reset"
            onClick={() => onDriverSelect && onDriverSelect('reset')}
            title="Reset driver filter"
            type="button"
          >
            <RotateCcw aria-hidden="true" size={17} />
          </button>
        )}
      </div>

      <label className="championship-driver-filter__add">
        <span>Driver</span>
        <select
          aria-label="Add a driver to the championship chart"
          disabled={selectionIsFull}
          onChange={(event) => {
            if (event.target.value) {
              onDriverSelect?.('toggle', event.target.value);
              event.target.value = '';
            }
          }}
          value=""
        >
          <option value="">{selectionIsFull ? 'Driver limit reached' : 'Add driver'}</option>
          {drivers.map((driver) => (
            <option
              disabled={selectedDrivers.includes(driver)}
              key={driver}
              value={driver}
            >
              {driver}
            </option>
          ))}
        </select>
      </label>

      {selectedDrivers.length > 0 && (
        <div className="championship-driver-filter__picks">
          {selectedDrivers.map((driver) => (
            <span
              className="championship-driver-filter__pick"
              key={driver}
              style={{ '--driver-selector-color': getTeamColor(getDriverTeam(driver)) }}
            >
              <DriverBrandLogo
                driver={driver}
                size="xs"
                team={getDriverTeam(driver)}
                year={seasonYear}
              />
              <TeamLogo
                size="xs"
                team={getDriverTeam(driver)}
                tone="team"
                year={seasonYear}
              />
              <span>{driver}</span>
              <button
                aria-label={`Remove ${driver}`}
                onClick={() => onDriverSelect?.('toggle', driver)}
                title={`Remove ${driver}`}
                type="button"
              >
                <X aria-hidden="true" size={14} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

// Statistics display cards
export const StatsGrid = ({ stats = [], className = '' }) => {
  return (
    <div className={`stats-grid ${className}`}>
      {stats.map((stat, index) => (
        <div key={index} className={`stat-card ${stat.color || 'blue'}`}>
          <h3>{stat.label}</h3>
          <div className="stat-value">{stat.value}</div>
          {stat.sublabel && <div className="stat-label">{stat.sublabel}</div>}
        </div>
      ))}
    </div>
  );
};

// F1 Page Layout wrapper for consistent styling
export const F1PageLayout = ({ 
  title,
  subtitle,
  children,
  className = '',
  showHeader = true
}) => {
  return (
    <div className={`f1-page-layout ${className}`}>
      {showHeader && (
        <div className="page-header">
          <h1 className="page-title">{title}</h1>
          {subtitle && <p className="page-subtitle">{subtitle}</p>}
        </div>
      )}
      <div className="page-content">
        {children}
      </div>
    </div>
  );
};

// Championship chart specifically for bump charts
export const ChampionshipBumpChart = ({ 
  data, 
  options, 
  type = 'driver', // 'driver' or 'constructor'
  title,
  selectedDrivers = [],
  onDriverSelect,
  allDrivers = [],
  isMobile = false,
  showRaceCars = false,
  maxDrivers = 2,
  seasonYear = 2026,
}) => {
  const chartTitle = title || `${type === 'driver' ? 'Driver' : 'Constructor'} Championship Standings`;
  const teamByDriver = React.useMemo(() => new Map(
    (data?.datasets ?? []).map(({ label, team }) => [label, team]),
  ), [data]);
  
  return (
    <F1PageLayout 
      title={chartTitle}
      subtitle="Race-by-race progression throughout the season"
      className={`championship-chart ${type}-championship`}
    >
      {/* Driver selector for driver charts */}
      {type === 'driver' && allDrivers.length > 0 && (
        <DriverSelector
          drivers={allDrivers}
          selectedDrivers={selectedDrivers}
          onDriverSelect={onDriverSelect}
          maxDrivers={maxDrivers}
          isMobile={isMobile}
          title="Filter Drivers"
          teamByDriver={teamByDriver}
          seasonYear={seasonYear}
        />
      )}

      {/* Chart */}
      {showRaceCars ? (
        <DriverRaceChart
          key={selectedDrivers.join('|') || 'top-five'}
          data={data}
          options={options}
          selectedDrivers={selectedDrivers}
          className="championship-line-chart"
          style={{ height: isMobile ? '400px' : '600px' }}
          isMobile={isMobile}
          seasonYear={seasonYear}
        />
      ) : (
        <ResponsiveChart
          type="line"
          data={data}
          options={options}
          className="championship-line-chart"
          style={{ height: isMobile ? '400px' : '600px' }}
        />
      )}
    </F1PageLayout>
  );
};
