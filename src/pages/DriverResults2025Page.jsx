import React, { useEffect, useState, useMemo } from "react";
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
import f1SeasonData from "../data/f1_2025_season.json";
import { createResponsiveChartOptions } from "../utils/chartOptions.jsx";
import { useProcessedRaceData, getAllDrivers, getTeamColor } from "../utils/dataProcessing.js";
import { F1PageLayout, ResponsiveChart } from "../components/ChartComponents.jsx";
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

// Custom hook for race results data with proper driver handling
const useRaceResultsData = (rawRaces, selectedDrivers = [], isMobile = false) => {
  const processedRaces = useProcessedRaceData(rawRaces);
  
  return useMemo(() => {
    if (!processedRaces || processedRaces.length === 0) return null;

    const standings = new Map();
    const raceLabels = [];

    processedRaces.forEach((round) => {
      const { race_results, circuit } = round;
      // Use circuit name like WDC page, not round number
      const circuitLabel = circuit?.split(" ")[0] || `R${round.round}`;
      raceLabels.push(circuitLabel);

      race_results.forEach(({ driver, position }) => {
        if (!standings.has(driver)) {
          standings.set(driver, []);
        }
        standings.get(driver).push(position);
      });

      // Fill missing positions with null for drivers who didn't participate
      for (const [driver, posArr] of standings.entries()) {
        if (posArr.length < raceLabels.length) {
          posArr.push(null);
        }
      }
    });

    const datasets = Array.from(standings.entries()).map(([driver, positions]) => {
      // Find team from the most recent race where driver participated
      let team = null;
      for (let i = processedRaces.length - 1; i >= 0; i--) {
        const result = processedRaces[i].race_results.find((res) => res.driver === driver);
        if (result) {
          team = result.team;
          break;
        }
      }

      const isSelected = selectedDrivers.length === 0 || selectedDrivers.includes(driver);

      return {
        label: driver,
        data: positions,
        borderColor: isSelected ? getTeamColor(team) : "rgba(200,200,200,0.3)",
        borderWidth: isSelected ? (isMobile ? 2 : 3) : 1,
        pointRadius: isSelected ? (isMobile ? 2 : 3) : 1,
        pointHoverRadius: isSelected ? (isMobile ? 4 : 5) : 2,
        fill: false,
        tension: 0,
      };
    });

    return { labels: raceLabels, datasets };
  }, [processedRaces, selectedDrivers, isMobile]);
};

const DriverResults2025Page = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Get processed race data for tooltips (BEFORE driver changes)
  const rawRaces = useMemo(() => f1SeasonData.races, []);
  const processedRaces = useProcessedRaceData(rawRaces);
  
  // Get all drivers from the data (this will show both Jack Doohan AND Franco Colapinto)
  const allDrivers = useMemo(() => {
    const driversSet = new Set();
    
    // Get drivers from RAW data to show original drivers for early races
    rawRaces.forEach(race => {
      race.race_results?.forEach(result => {
        driversSet.add(result.driver);
      });
    });
    
    // Also get drivers from processed data to show current drivers
    processedRaces.forEach(race => {
      race.race_results?.forEach(result => {
        driversSet.add(result.driver);
      });
    });
    
    return Array.from(driversSet).sort();
  }, [rawRaces, processedRaces]);
  
  // Handle driver selection
  const [selectedDrivers, setSelectedDrivers] = useState([]);
  
  // Get race results data - but we need to use RAW data to show original drivers
  const chartData = useMemo(() => {
    if (!rawRaces || rawRaces.length === 0) return null;

    const standings = new Map();
    const raceLabels = [];

    rawRaces.forEach((round) => {
      const { race_results, circuit } = round;
      // Use circuit name like WDC page
      const circuitLabel = circuit?.split(" ")[0] || `R${round.round}`;
      raceLabels.push(circuitLabel);

      race_results.forEach(({ driver, position }) => {
        if (!standings.has(driver)) {
          standings.set(driver, []);
        }
        standings.get(driver).push(position);
      });

      // Fill missing positions with null for drivers who didn't participate
      for (const [driver, posArr] of standings.entries()) {
        if (posArr.length < raceLabels.length) {
          posArr.push(null);
        }
      }
    });

    const datasets = Array.from(standings.entries()).map(([driver, positions]) => {
      // Find team from the most recent race where driver participated
      let team = null;
      for (let i = rawRaces.length - 1; i >= 0; i--) {
        const result = rawRaces[i].race_results.find((res) => res.driver === driver);
        if (result) {
          team = result.team;
          break;
        }
      }

      const isSelected = selectedDrivers.length === 0 || selectedDrivers.includes(driver);

      return {
        label: driver,
        data: positions,
        borderColor: isSelected ? getTeamColor(team) : "rgba(200,200,200,0.3)",
        borderWidth: isSelected ? (isMobile ? 2 : 3) : 1,
        pointRadius: isSelected ? (isMobile ? 2 : 3) : 1,
        pointHoverRadius: isSelected ? (isMobile ? 4 : 5) : 2,
        fill: false,
        tension: 0,
      };
    });

    return { labels: raceLabels, datasets };
  }, [rawRaces, selectedDrivers, isMobile]);

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
      "2025 Driver Race Results Bump Chart",
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
            const raceIndex = context.dataIndex;
            const round = rawRaces[raceIndex]; // Use raw data for tooltips
            const result = round?.race_results.find((r) => r.driver === driver);

            if (!result) return `${driver}: No data`;

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
        max: 20,
      },
    },
  };

  return (
    <F1PageLayout 
      title="2025 Driver Race Results Bump Chart"
      subtitle="Position-based performance tracking by race"
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
      
      {/* Race Results Chart */}
      <ResponsiveChart 
        type="line" 
        data={chartData} 
        options={options}
        className="race-results-line-chart"
        style={{ height: isMobile ? '400px' : '600px' }}
        loading={!chartData}
        error={!chartData && rawRaces.length === 0 ? "No race data available" : null}
      />
    </F1PageLayout>
  );
};

export default DriverResults2025Page;