import React, { useEffect, useState } from "react";
import { Line } from "react-chartjs-2";
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
import ResponsiveChartContainer from "../components/ResponsiveChartContainer";
import { createResponsiveChartOptions } from "../utils/chartOptions.jsx";

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
  const [chartData, setChartData] = useState(null);
  const [cumulativePointsMap, setCumulativePointsMap] = useState(new Map());
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const buildChartData = () => {
      const races = f1SeasonData.races || [];
      const allConstructors = new Set();
      const pointsHistory = [];

      const raceRounds = races.map((race) => {
        return race.circuit?.split(" ")[0] || `R${race.round}`;
      });

      races.forEach((round) => {
        const roundPoints = new Map();
        
        // Add race points
        round.race_results.forEach(({ team, points }) => {
          allConstructors.add(team);
          roundPoints.set(team, (roundPoints.get(team) || 0) + points);
        });
        
        // Add sprint points to round totals
        if (round.sprint_results) {
          round.sprint_results.forEach(({ team, points }) => {
            allConstructors.add(team);
            roundPoints.set(team, (roundPoints.get(team) || 0) + points);
          });
        }
        
        pointsHistory.push(roundPoints);
      });

      const teamStandings = new Map();
      const cumulativeMap = new Map();
      const runningTotals = new Map();

      [...allConstructors].forEach((team) => {
        teamStandings.set(team, []);
        cumulativeMap.set(team, []);
      });

      pointsHistory.forEach((roundPoints) => {
        roundPoints.forEach((points, team) => {
          runningTotals.set(team, (runningTotals.get(team) || 0) + points);
        });

        const sorted = [...runningTotals.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([team]) => team);

        [...allConstructors].forEach((team) => {
          const pos = sorted.indexOf(team);
          const totalPts = runningTotals.get(team) || 0;
          teamStandings.get(team).push(pos !== -1 ? pos + 1 : null);
          cumulativeMap.get(team).push(totalPts);
        });
      });

      const datasets = [...teamStandings.entries()].map(([team, positions]) => ({
        label: team,
        data: positions,
        borderColor: getTeamColor(team),
        backgroundColor: getTeamColor(team),
        fill: false,
        tension: 0.3,
        pointRadius: isMobile ? 2 : 3,
        pointHoverRadius: isMobile ? 4 : 6,
        borderWidth: isMobile ? 2 : 3,
      }));

      setChartData({
        labels: raceRounds,
        datasets,
      });

      setCumulativePointsMap(cumulativeMap);
    };

    buildChartData();
  }, [isMobile]);

  const getTeamColor = (team) => {
    const teamColors = {
      "McLaren": "#FF8700",
      "Red Bull Racing": "#1E41FF",
      "Mercedes": "#00D2BE",
      "Ferrari": "#DC0000",
      "Williams": "#005AFF",
      "Alpine": "#FF69B4",
      "Aston Martin": "#006F62",
      "Haas": "#B6BABD",
      "Racing Bulls": "#2B4562",
      "Kick Sauber": "#00F500",
    };
    return teamColors[team] || "#222";
  };

  // Create custom options with enhanced tooltips
  const options = {
    ...createResponsiveChartOptions(
      isMobile, 
      "2025 Constructor Championship Standings",
      "constructor"
    ),
    // Override tooltip to show both position and points
    plugins: {
      ...createResponsiveChartOptions(isMobile, "", "constructor").plugins,
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
            const cumulativePoints = cumulativePointsMap.get(team)?.[roundIndex] ?? 0;
            
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
            cumulativePointsMap.forEach((pointsArray, team) => {
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
  };

  return (
    <ResponsiveChartContainer title="2025 Constructor Championship Bump Chart">
      {chartData ? <Line data={chartData} options={options} /> : <p>Loading chart...</p>}
    </ResponsiveChartContainer>
  );
};

export default ConstructorBump2025Page;