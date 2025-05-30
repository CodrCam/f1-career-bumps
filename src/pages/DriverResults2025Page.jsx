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
import { useProcessedRaceData, getTeamColor, getAllDriversIncludingOriginals } from "../utils/dataProcessing.js";
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

const DriverResults2025Page = () => {
  const [selectedDrivers, setSelectedDrivers] = useState([]);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Get both raw and processed race data
  const rawRaces = useMemo(() => f1SeasonData.races, []);
  const processedRaces = useProcessedRaceData(rawRaces);
  
  // Get all drivers including both original and replacement drivers (should be 21 total)
  const allDrivers = useMemo(() => {
    return getAllDriversIncludingOriginals(rawRaces, processedRaces);
  }, [rawRaces, processedRaces]);

  // Create chart data that shows both original and replacement drivers correctly
  const chartData = useMemo(() => {
    if (!rawRaces || rawRaces.length === 0) return null;

    const standings = new Map();
    const raceLabels = [];

    // Build race labels
    rawRaces.forEach((round) => {
      const { circuit } = round;
      const circuitLabel = circuit?.split(" ")[0] || `R${round.round}`;
      raceLabels.push(circuitLabel);
    });

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

      return {
        label: driver,
        data: positions,
        borderColor: isSelected ? getTeamColor(team) : "rgba(200,200,200,0.3)",
        borderWidth: isSelected ? (isMobile ? 2 : 3) : 1,
        pointRadius: isSelected ? (isMobile ? 2 : 3) : 1,
        pointHoverRadius: isSelected ? (isMobile ? 4 : 5) : 2,
        fill: false,
        tension: 0,
        spanGaps: false, // Don't connect points across null values
      };
    });

    return { labels: raceLabels, datasets };
  }, [rawRaces, processedRaces, selectedDrivers, isMobile]);

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
        max: 20,
      },
    },
  };

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