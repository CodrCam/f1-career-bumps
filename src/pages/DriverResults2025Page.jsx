import React, { useEffect, useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { Maximize2, RotateCcw, SlidersHorizontal } from "lucide-react";
import {
  Chart as ChartJS,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { useSeasonData } from "../hooks/useSeasonData.js";
import { getSeasonFromParam } from "../utils/seasons.js";
import { createResponsiveChartOptions } from "../utils/chartOptions.jsx";
import { useProcessedRaceData, getTeamColor, getAllDriversIncludingOriginals } from "../utils/dataProcessing.js";
import { getTrackName } from "../utils/raceLabels.js";
import { F1PageLayout, ResponsiveChart, SeasonDataState } from "../components/ChartComponents.jsx";
import { ResponsiveDriverSelector } from "../components/UIControls.jsx";

ChartJS.register(
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Title,
  Tooltip,
  Legend
);

const DriverResults2025Page = () => {
  const [selectedDrivers, setSelectedDrivers] = useState([]);
  const [visibleStart, setVisibleStart] = useState(0);
  const [visibleCount, setVisibleCount] = useState(9);
  const [showSelectedOnly, setShowSelectedOnly] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const { seasonYear } = useParams();
  const selectedYear = getSeasonFromParam(seasonYear);
  const { races, status, error, retry } = useSeasonData(selectedYear);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Get both raw and processed race data
  const rawRaces = useMemo(() => races, [races]);
  const processedRaces = useProcessedRaceData(rawRaces);
  const totalRaces = rawRaces.length;
  const minimumWindow = Math.min(totalRaces || 1, 3);
  const defaultWindow = Math.min(totalRaces || 9, 9);

  useEffect(() => {
    if (totalRaces === 0) return;

    setVisibleCount((current) => {
      const nextCount = Math.min(Math.max(current || defaultWindow, minimumWindow), totalRaces);
      setVisibleStart((currentStart) => Math.min(currentStart, Math.max(0, totalRaces - nextCount)));
      return nextCount;
    });
  }, [defaultWindow, minimumWindow, totalRaces]);
  
  // Get all drivers including both original and replacement drivers (should be 21 total)
  const allDrivers = useMemo(() => {
    return getAllDriversIncludingOriginals(rawRaces, processedRaces);
  }, [rawRaces, processedRaces]);

  const maxFinishPosition = useMemo(() => {
    const positions = rawRaces.flatMap((race) => (
      race.race_results ?? []
    ).map((result) => result.position).filter((position) => typeof position === 'number'));

    return Math.max(20, ...positions);
  }, [rawRaces]);

  const visibleRaceIndexes = useMemo(() => {
    return rawRaces
      .map((_, index) => index)
      .slice(visibleStart, visibleStart + visibleCount);
  }, [rawRaces, visibleCount, visibleStart]);

  const visibleRaces = useMemo(() => {
    return visibleRaceIndexes.map((raceIndex) => rawRaces[raceIndex]).filter(Boolean);
  }, [rawRaces, visibleRaceIndexes]);

  const updateRaceWindow = (nextCount, nextStart = visibleStart) => {
    if (totalRaces === 0) return;

    const clampedCount = Math.min(totalRaces, Math.max(minimumWindow, nextCount));
    const maxStart = Math.max(0, totalRaces - clampedCount);
    setVisibleCount(clampedCount);
    setVisibleStart(Math.min(Math.max(0, nextStart), maxStart));
  };

  const showAllRaces = () => updateRaceWindow(totalRaces, 0);
  const showLatestRaces = () => updateRaceWindow(defaultWindow, Math.max(0, totalRaces - defaultWindow));
  const resetRaceWindow = () => updateRaceWindow(defaultWindow, 0);

  const handleVisibleCountChange = (event) => {
    const nextCount = Number(event.target.value);
    const center = visibleStart + (visibleCount / 2);
    updateRaceWindow(nextCount, Math.round(center - (nextCount / 2)));
  };

  const handleVisibleStartChange = (event) => {
    updateRaceWindow(visibleCount, Number(event.target.value));
  };

  // Create chart data that shows both original and replacement drivers correctly
  const chartData = useMemo(() => {
    if (!rawRaces || rawRaces.length === 0) return null;

    const standings = new Map();
    const raceLabels = visibleRaces.map((round) => getTrackName(round));

    // Process each race to build driver standings
    rawRaces.forEach((round, raceIndex) => {
      const { race_results } = round;
      
      race_results.forEach(({ driver, position, team }) => {
        // Check if this driver was replaced starting from this round
        const driverChange = [
          {
            from: "Jack Doohan",
            to: "Franco Colapinto", 
            team: "Alpine",
            fromRound: 7
          }
        ].find(change => 
          driver === change.from && 
          team === change.team && 
          round.round >= change.fromRound
        );

        if (driverChange) {
          // Add position for replacement driver
          if (!standings.has(driverChange.to)) {
            standings.set(driverChange.to, new Array(rawRaces.length).fill(null));
          }
          standings.get(driverChange.to)[raceIndex] = position;
          
          // Ensure original driver exists with nulls for this race
          if (!standings.has(driver)) {
            standings.set(driver, new Array(rawRaces.length).fill(null));
          }
          // Original driver gets null for this race (already set by fill(null))
        } else {
          // Normal driver - add their position
          if (!standings.has(driver)) {
            standings.set(driver, new Array(rawRaces.length).fill(null));
          }
          standings.get(driver)[raceIndex] = position;
        }
      });
    });

    const datasets = Array.from(standings.entries()).map(([driver, positions]) => {
      // Find team from the most recent race where driver participated
      let team = null;
      
      // First try to find team from processed data (for replacement drivers)
      for (let i = processedRaces.length - 1; i >= 0; i--) {
        const result = processedRaces[i].race_results.find((res) => res.driver === driver);
        if (result) {
          team = result.team;
          break;
        }
      }
      
      // If not found, try raw data (for original drivers)
      if (!team) {
        for (let i = rawRaces.length - 1; i >= 0; i--) {
          const result = rawRaces[i].race_results.find((res) => res.driver === driver);
          if (result) {
            team = result.team;
            break;
          }
        }
      }

      const isSelected = selectedDrivers.length === 0 || selectedDrivers.includes(driver);
      if (showSelectedOnly && selectedDrivers.length > 0 && !isSelected) return null;

      return {
        label: driver,
        data: positions.slice(visibleStart, visibleStart + visibleCount),
        borderColor: isSelected ? getTeamColor(team) : "rgba(200,200,200,0.3)",
        borderWidth: isSelected ? (isMobile ? 2 : 3) : 1,
        pointRadius: isSelected ? (isMobile ? 2 : 3) : 1,
        pointHoverRadius: isSelected ? (isMobile ? 4 : 5) : 2,
        fill: false,
        tension: 0,
        spanGaps: false, // Don't connect points across null values
      };
    }).filter(Boolean);

    return { labels: raceLabels, datasets };
  }, [isMobile, processedRaces, rawRaces, selectedDrivers, showSelectedOnly, visibleCount, visibleRaces, visibleStart]);

  // Handle driver selection for mobile/desktop
  const handleDriverChange = (index, value) => {
    if (index === 'reset') {
      setSelectedDrivers([]);
    } else {
      const newSelection = [...selectedDrivers];
      newSelection[index] = value;
      setSelectedDrivers(newSelection.filter(Boolean)); // Remove empty strings
    }
  };

  // Create custom options with enhanced tooltips for race results
  const options = {
    ...createResponsiveChartOptions(
      isMobile, 
      `${selectedYear} Driver Race Results Bump Chart`,
      "results"
    ),
    // Override the tooltip for this specific chart
    plugins: {
      ...createResponsiveChartOptions(isMobile, "", "results").plugins,
      tooltip: {
        enabled: true,
        callbacks: {
          title: function(context) {
            return context[0].label;
          },
          label: function (context) {
            const driver = context.dataset.label;
            const position = context.raw;
            const raceIndex = visibleRaceIndexes[context.dataIndex];
            
            if (position === null) return `${driver}: Did not participate`;

            // Try to find result in processed data first (for replacement drivers)
            let result = processedRaces[raceIndex]?.race_results.find((r) => r.driver === driver);
            
            // If not found, try raw data (for original drivers)
            if (!result) {
              result = rawRaces[raceIndex]?.race_results.find((r) => r.driver === driver);
            }

            if (!result) return `${driver}: Position ${position}`;

            const { team } = result;
            return [
              `${driver}`,
              `Team: ${team}`,
              `Finish: P${position}`
            ];
          },
        },
      },
    },
    scales: {
      ...createResponsiveChartOptions(isMobile, "", "results").scales,
      y: {
        ...createResponsiveChartOptions(isMobile, "", "results").scales.y,
        reverse: true,
        beginAtZero: false,
        min: 1,
        max: maxFinishPosition,
      },
    },
  };

  const isShowingAllRaces = totalRaces > 0 && visibleCount >= totalRaces;
  const windowEnd = Math.min(totalRaces, visibleStart + visibleCount);
  const maxVisibleStart = Math.max(0, totalRaces - visibleCount);
  const visibleCountSliderMax = Math.max(minimumWindow, totalRaces);
  const visibleCountSliderValue = Math.min(Math.max(visibleCount, minimumWindow), visibleCountSliderMax);
  const targetWindow = Math.min(9, totalRaces || 9);

  if (rawRaces.length === 0) {
    return (
      <F1PageLayout className="race-results-chart">
        <SeasonDataState
          status={status}
          error={error}
          onRetry={retry}
        />
      </F1PageLayout>
    );
  }

  return (
    <F1PageLayout 
      className="race-results-chart"
    >
      {/* Driver Selector */}
      <ResponsiveDriverSelector
        drivers={allDrivers}
        selectedDrivers={[selectedDrivers[0] || "", selectedDrivers[1] || ""]}
        onDriverChange={handleDriverChange}
        maxDrivers={2}
        isMobile={isMobile}
      />

      <div className="race-results-controls">
        <div className="race-window-sliders" aria-label="Race result chart window controls">
          <label className="race-slider-control">
            <span>
              <SlidersHorizontal size={16} />
              Races shown
            </span>
            <input
              type="range"
              min={minimumWindow}
              max={visibleCountSliderMax}
              step="1"
              value={visibleCountSliderValue}
              onChange={handleVisibleCountChange}
              disabled={totalRaces <= minimumWindow}
              aria-label="Number of races shown"
            />
            <div className="race-slider-scale" aria-hidden="true">
              <span>{minimumWindow}</span>
              <span>{targetWindow}</span>
              <span>All</span>
            </div>
          </label>

          <label className={`race-slider-control ${isShowingAllRaces ? 'disabled' : ''}`}>
            <span>Window position</span>
            <input
              type="range"
              min="0"
              max={maxVisibleStart}
              step="1"
              value={visibleStart}
              onChange={handleVisibleStartChange}
              disabled={isShowingAllRaces}
              aria-label="Race window position"
            />
            <div className="race-slider-scale" aria-hidden="true">
              <span>Start</span>
              <span>Mid</span>
              <span>Latest</span>
            </div>
          </label>
        </div>

        <div className="race-window-control-group" aria-label="Race result chart presets">
          <button type="button" onClick={showAllRaces} disabled={isShowingAllRaces}>
            <Maximize2 size={16} />
            All
          </button>
          <button type="button" onClick={showLatestRaces} disabled={totalRaces <= defaultWindow && visibleStart === Math.max(0, totalRaces - defaultWindow)}>
            Latest
          </button>
          <button type="button" onClick={resetRaceWindow} disabled={visibleStart === 0 && visibleCount === defaultWindow}>
            <RotateCcw size={16} />
            Reset
          </button>
          <label className={`race-window-toggle ${selectedDrivers.length === 0 ? 'disabled' : ''}`}>
            <input
              type="checkbox"
              checked={showSelectedOnly}
              disabled={selectedDrivers.length === 0}
              onChange={(event) => setShowSelectedOnly(event.target.checked)}
            />
            Selected only
          </label>
        </div>

        <div className="race-window-status">
          Races {totalRaces === 0 ? 0 : visibleStart + 1}-{windowEnd} of {totalRaces}
        </div>
      </div>
      
      {/* Race Results Chart */}
      <ResponsiveChart
        type="line"
        data={chartData}
        options={options}
        className="race-results-line-chart"
        style={{ height: isMobile ? '400px' : '600px' }}
      />

    </F1PageLayout>
  );
};

export default DriverResults2025Page;
