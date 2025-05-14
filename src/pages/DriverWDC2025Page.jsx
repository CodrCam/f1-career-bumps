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
  const [selectedDrivers, setSelectedDrivers] = useState(["", ""]);

  const allDrivers = Array.from(
    new Set(
      f1SeasonData.races.flatMap((race) =>
        race.race_results.map((res) => res.driver)
      )
    )
  ).sort();

  useEffect(() => {
    const buildChartData = () => {
      const pointsMap = new Map();
      const raceLabels = [];
      const races = f1SeasonData.races || [];

      races.forEach((race, i) => {
        const circuitLabel = race.circuit?.split(" ")[0] ?? `R${race.round}`;
        raceLabels.push(circuitLabel);

        // Collect sprint points per driver
        const sprintMap = new Map();
        if (Array.isArray(race.sprint_results)) {
          race.sprint_results.forEach(({ driver, points }) => {
            sprintMap.set(driver, points);
          });
        }

        // Add race + sprint points to each driver's running total
        race.race_results.forEach(({ driver, points }) => {
          const sprintPoints = sprintMap.get(driver) || 0;
          const total = points + sprintPoints;

          if (!pointsMap.has(driver)) {
            pointsMap.set(driver, []);
          }

          const prev = pointsMap.get(driver)[i - 1] || 0;
          pointsMap.get(driver).push(prev + total);
        });

        // Pad drivers who didn’t participate
        for (const [driver, arr] of pointsMap.entries()) {
          if (arr.length < raceLabels.length) {
            const last = arr[arr.length - 1] || 0;
            arr.push(last);
          }
        }
      });

      const datasets = Array.from(pointsMap.entries()).map(([driver, points]) => {
        const team = races.find((r) =>
          r.race_results.some((res) => res.driver === driver)
        )?.race_results.find((res) => res.driver === driver)?.team;

        const isSelected =
          selectedDrivers.every((sel) => !sel) || selectedDrivers.includes(driver);

        return {
          label: driver,
          data: points,
          borderColor: isSelected ? getTeamColor(team) : "rgba(200,200,200,0.3)",
          borderWidth: isSelected ? 2 : 1,
          pointRadius: isSelected ? 3 : 1,
          pointHoverRadius: isSelected ? 5 : 2,
          fill: false,
          tension: 0.3,
        };
      });

      setChartData({ labels: raceLabels, datasets });
    };

    buildChartData();
  }, [selectedDrivers]);

  const getTeamColor = (team) => {
    const teamColors = {
      McLaren: "#FF8700",
      "Red Bull Racing": "#1E41FF",
      Mercedes: "#00D2BE",
      Ferrari: "#DC0000",
      Williams: "#005AFF",
      Alpine: "#0090FF",
      "Aston Martin": "#00665E",
      Haas: "#B6BABD",
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
            const driver = context.dataset.label;
            const cumulativePoints = context.raw;
            return `${roundLabel}: ${driver} — ${cumulativePoints} pts`;
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
          text: "Circuit",
        },
      },
    },
  };

  return (
    <div style={{ padding: "2rem" }}>
      <h1 style={{ textAlign: "center", fontSize: "2rem", marginBottom: "1rem" }}>
        2025 Driver World Championship Bump Chart
      </h1>

      <div style={{ display: "flex", justifyContent: "center", gap: "1rem", marginBottom: "1.5rem" }}>
        {[0, 1].map((i) => (
          <select
            key={i}
            value={selectedDrivers[i]}
            onChange={(e) => {
              const copy = [...selectedDrivers];
              copy[i] = e.target.value;
              setSelectedDrivers(copy);
            }}
          >
            <option value="">Select Driver {i + 1}</option>
            {allDrivers.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        ))}
        <button onClick={() => setSelectedDrivers(["", ""])}>Reset</button>
      </div>

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