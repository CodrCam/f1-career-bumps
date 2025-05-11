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
import LayoutWrapper from "../components/LayoutWrapper";

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

  useEffect(() => {
    const buildChartData = () => {
      const races = f1SeasonData.races || [];
      const allConstructors = new Set();
      const raceRounds = [];
      const pointsHistory = [];

      // Track constructor points per race
      races.forEach((round) => {
        const { round: raceRound, race_results } = round;
        raceRounds.push(`R${raceRound}`);

        const roundPoints = new Map();
        race_results.forEach(({ team, points }) => {
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
        fill: false,
        tension: 0.3,
        pointRadius: 3,
        pointHoverRadius: 6,
        borderWidth: 2,
      }));

      setChartData({
        labels: raceRounds,
        datasets,
      });
      setCumulativePointsMap(cumulativeMap);
    };

    buildChartData();
  }, []);

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
    return teamColors[team] || "#888";
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: {
        display: true,
        text: "2025 Constructor Championship Standings Bump Chart",
        font: { size: 20 },
      },
      tooltip: {
        callbacks: {
          label: function (context) {
            const roundIndex = context.dataIndex;
            const team = context.dataset.label;
            const position = context.raw;
            const cumulativePoints = cumulativePointsMap.get(team)?.[roundIndex] ?? "N/A";

            return `R${roundIndex + 1}: ${team}
P${position} • ${cumulativePoints} pts`;
          },
        },
      },
      legend: {
        position: "bottom",
        align: "center",
        labels: {
          boxWidth: 12,
          padding: 10,
        },
      },
    },
    layout: {
      padding: 20,
    },
    scales: {
      y: {
        reverse: true,
        min: 1,
        max: 10,
        title: {
          display: true,
          text: "Championship Position",
        },
        ticks: {
          stepSize: 1,
          callback: (value) => `P${value}`,
        },
      },
      x: {
        title: {
          display: true,
          text: "Race Round",
        },
      },
    },
  };

  return (
    <LayoutWrapper>
      <h1 style={{ textAlign: "center", fontSize: "2rem", marginBottom: "1rem" }}>
        2025 Constructor Championship Bump Chart
      </h1>
      <div
        style={{
          height: "80vh",
          width: "100vw",
          overflowX: "auto",
          padding: "0 2rem",
          boxSizing: "border-box",
        }}
      >
        {chartData ? <Line data={chartData} options={options} /> : <p>Loading chart...</p>}
      </div>
    </LayoutWrapper>
  );
};

export default ConstructorBump2025Page;