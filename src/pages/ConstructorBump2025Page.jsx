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
        round.race_results.forEach(({ team, points }) => {
          allConstructors.add(team);
          roundPoints.set(team, (roundPoints.get(team) || 0) + points);
        });
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
      "Alpine": "#0090FF",
      "Aston Martin": "#00665E",
      "Haas": "#B6BABD",
      "Racing Bulls": "#2B4562",
      "Kick Sauber": "#00F500",
    };
    return teamColors[team] || "#222";
  };

  const options = createResponsiveChartOptions(
    isMobile, 
    "2025 Constructor Championship Standings",
    "constructor"
  );

  return (
    <ResponsiveChartContainer title="2025 Constructor Championship Bump Chart">
      {chartData ? <Line data={chartData} options={options} /> : <p>Loading chart...</p>}
    </ResponsiveChartContainer>
  );
};

export default ConstructorBump2025Page;