// src/pages/DriverResults2025Page.jsx

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

const DriverResults2025Page = () => {
  const [chartData, setChartData] = useState(null);

  useEffect(() => {
    const buildChartData = () => {
      const standings = new Map();
      const raceRounds = [];

      const races = f1SeasonData.races || [];

      races.forEach((round) => {
        const { round: raceRound, race_results } = round;
        raceRounds.push(`R${raceRound}`);

        race_results.forEach((result) => {
          const { driver, position } = result;

          if (!standings.has(driver)) {
            standings.set(driver, []);
          }

          standings.get(driver).push(position);
        });

        // Fill in nulls for missing drivers in a round
        for (const [driverName, positions] of standings.entries()) {
          if (positions.length < raceRounds.length) {
            positions.push(null);
          }
        }
      });

      const datasets = Array.from(standings.entries()).map(([driver, positions]) => {
        const team = races.find(round => round.race_results.some(r => r.driver === driver))
                        ?.race_results.find(r => r.driver === driver)?.team;

        return {
          label: driver,
          data: positions,
          borderColor: getTeamColor(team),
          fill: false,
          tension: 0,
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
        text: "2025 Driver Race Results Bump Chart",
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
            const position = context.raw;
            const driver = context.dataset.label;
            return `${roundLabel}: ${driver} (P${position})`;
          },
        },
      },
    },
    scales: {
      y: {
        reverse: true,
        beginAtZero: false,
        min: 1,
        max: 20,
        ticks: {
          precision: 0,
          stepSize: 1,
          callback: (value) => `P${value}`,
        },
        title: {
          display: true,
          text: "Race Result Position",
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
        2025 Driver Race Results Bump Chart
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

export default DriverResults2025Page;
