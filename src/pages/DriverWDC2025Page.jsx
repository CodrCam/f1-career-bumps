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

ChartJS.register(
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Title,
  Tooltip,
  Legend
);

const DriverWDC2025Page = () => {
  const [chartData, setChartData] = useState(null);

  useEffect(() => {
    const buildChartData = () => {
      const pointsMap = new Map();
      const raceRounds = [];

      const races = f1SeasonData.races || [];

      races.forEach((round, roundIndex) => {
        const { round: raceRound, race_results } = round;
        raceRounds.push(`R${raceRound}`);

        race_results.forEach((result) => {
          const { driver, points } = result;

          if (!pointsMap.has(driver)) {
            pointsMap.set(driver, []);
          }

          const prevPoints = pointsMap.get(driver)[roundIndex - 1] || 0;
          const newPoints = prevPoints + points;
          pointsMap.get(driver).push(newPoints);
        });

        // Fill missing drivers with last known cumulative point or 0
        for (const [driver, pointsArr] of pointsMap.entries()) {
          if (pointsArr.length < raceRounds.length) {
            const last = pointsArr[pointsArr.length - 1] || 0;
            pointsArr.push(last);
          }
        }
      });

      const datasets = Array.from(pointsMap.entries()).map(([driver, points]) => {
        const team = races.find(round => round.race_results.some(r => r.driver === driver))
                        ?.race_results.find(r => r.driver === driver)?.team;

        return {
          label: driver,
          data: points,
          borderColor: getTeamColor(team),
          fill: false,
          tension: 0.3,
          pointRadius: 3,
          pointHoverRadius: 5,
        };
      });

      setChartData({
        labels: raceRounds,
        datasets,
      });
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
      "Kick Sauber": "#00F500"
    };
    return teamColors[team] || "#888";
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: {
        display: true,
        text: "2025 Driver World Championship Standings",
        font: { size: 18 },
      },
      legend: {
        position: "right",
        align: "start",
        labels: {
          boxWidth: 12,
          padding: 8,
        },
      },
      tooltip: {
        callbacks: {
          label: function (context) {
            const roundLabel = context.label;
            const points = context.raw;
            const driver = context.dataset.label;
            return `${roundLabel}: ${driver} (${points} pts)`;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: "Cumulative Points",
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
    <div style={{ padding: "2rem" }}>
      <h1
        style={{
          textAlign: "center",
          fontSize: "2rem",
          marginBottom: "1rem",
        }}
      >
        2025 Driver World Championship Bump Chart
      </h1>
      <div
        style={{
          height: "85vh",
          width: "100vw",
          padding: "2rem",
          margin: "0 auto",
          boxSizing: "border-box",
        }}
      >
        {chartData ? (
          <Line data={chartData} options={options} />
        ) : (
          <p>Loading chart...</p>
        )}
      </div>
    </div>
  );
};

export default DriverWDC2025Page;
