import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
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
import { useConstructorData } from "../components/F1DataComponents.jsx";
import {
  ConstructorRaceChart,
  F1PageLayout,
  ResponsiveChart,
  SeasonDataState,
} from "../components/ChartComponents.jsx";

ChartJS.register(
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Title,
  Tooltip,
  Legend
);

const ConstructorBump2025Page = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const { seasonYear } = useParams();
  const selectedYear = getSeasonFromParam(seasonYear);
  const { races, status, error, retry } = useSeasonData(selectedYear);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Get constructor championship data
  const { chartData, cumulativeMap } = useConstructorData(races, isMobile);
  const maxConstructorPosition = Math.max(
    11,
    ...(chartData?.datasets ?? [])
      .flatMap((dataset) => dataset.data)
      .filter((position) => Number.isFinite(position))
  );
  const baseOptions = createResponsiveChartOptions(
    isMobile,
    `${selectedYear} Constructor Championship Standings`,
    "constructor"
  );

  // Create custom options with enhanced tooltips
  const options = {
    ...baseOptions,
    // Override tooltip to show both position and points
    plugins: {
      ...baseOptions.plugins,
      tooltip: {
        enabled: true,
        callbacks: {
          title: function(context) {
            return context[0].label;
          },
          label: function (context) {
            const team = context.dataset.label;
            const position = context.raw;
            const roundIndex = context.dataIndex;
            const cumulativePoints = cumulativeMap.get(team)?.[roundIndex] ?? 0;
            
            return [
              `${team}`,
              `Position: P${position}`,
              `Points: ${cumulativePoints}`
            ];
          },
          afterBody: function(context) {
            // Add gap information for context
            const roundIndex = context[0].dataIndex;
            const teams = [];
            
            // Get all teams and their points for this round
            cumulativeMap.forEach((pointsArray, team) => {
              const points = pointsArray[roundIndex] || 0;
              teams.push({ team, points });
            });
            
            // Sort by points descending
            teams.sort((a, b) => b.points - a.points);
            
            // Find the hovered team's position and show gap to leader/next team
            const hoveredTeam = context[0].dataset.label;
            const hoveredTeamData = teams.find(t => t.team === hoveredTeam);
            const hoveredPosition = teams.findIndex(t => t.team === hoveredTeam) + 1;
            
            if (hoveredPosition === 1) {
              // Leader - show gap to second place
              const gap = hoveredTeamData.points - (teams[1]?.points || 0);
              return gap > 0 ? [`Gap to P2: +${gap} pts`] : [];
            } else {
              // Not leader - show gap to leader and previous position
              const gapToLeader = teams[0].points - hoveredTeamData.points;
              const gapToPrevious = teams[hoveredPosition - 2].points - hoveredTeamData.points;
              
              return [
                `Gap to P1: -${gapToLeader} pts`,
                gapToPrevious > 0 ? `Gap to P${hoveredPosition - 1}: -${gapToPrevious} pts` : ''
              ].filter(Boolean);
            }
          }
        },
      },
    },
    scales: {
      ...baseOptions.scales,
      y: {
        ...baseOptions.scales.y,
        max: maxConstructorPosition,
        ticks: {
          ...baseOptions.scales.y.ticks,
          stepSize: 1,
        },
      },
    },
  };

  if (races.length === 0) {
    return (
      <F1PageLayout
        title={`${selectedYear} Constructor Championship Bump Chart`}
        subtitle="Team standings evolution throughout the season"
        className="constructor-championship"
      >
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
      title={`${selectedYear} Constructor Championship Bump Chart`}
      subtitle="Team standings evolution throughout the season"
      className="constructor-championship"
    >
      {selectedYear === 2026 ? (
        <ConstructorRaceChart
          data={chartData}
          options={options}
          className="constructor-line-chart"
          style={{ height: isMobile ? '400px' : '600px' }}
          isMobile={isMobile}
        />
      ) : (
        <ResponsiveChart
          type="line"
          data={chartData}
          options={options}
          className="constructor-line-chart"
          style={{ height: isMobile ? '400px' : '600px' }}
        />
      )}
    </F1PageLayout>
  );
};

export default ConstructorBump2025Page;
