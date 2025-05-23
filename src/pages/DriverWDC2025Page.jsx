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
import { createResponsiveChartOptions, createMobileDriverSelector } from "../utils/chartOptions.jsx";

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
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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

        const sprintMap = new Map();
        if (Array.isArray(race.sprint_results)) {
          race.sprint_results.forEach(({ driver, points }) => {
            sprintMap.set(driver, points);
          });
        }

        race.race_results.forEach(({ driver, points }) => {
          const sprintPoints = sprintMap.get(driver) || 0;
          const total = points + sprintPoints;

          if (!pointsMap.has(driver)) {
            pointsMap.set(driver, []);
          }

          const prev = pointsMap.get(driver)[i - 1] || 0;
          pointsMap.get(driver).push(prev + total);
        });

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
          borderWidth: isSelected ? (isMobile ? 2 : 3) : 1,
          pointRadius: isSelected ? (isMobile ? 2 : 3) : 1,
          pointHoverRadius: isSelected ? (isMobile ? 4 : 5) : 2,
          fill: false,
          tension: 0.3,
        };
      });

      setChartData({ labels: raceLabels, datasets });
    };

    buildChartData();
  }, [selectedDrivers, isMobile]);

  const getTeamColor = (team) => {
    // Updated with consistent team colors
    const teamColors = {
      McLaren: "#FF8700",
      "Red Bull Racing": "#1E41FF",
      Mercedes: "#00D2BE",
      Ferrari: "#DC0000",
      Williams: "#005AFF",
      Alpine: "#FF69B4",
      "Aston Martin": "#006F62",
      Haas: "#B6BABD",
      "Racing Bulls": "#2B4562",
      "Kick Sauber": "#00F500",
    };
    return teamColors[team] || "#888";
  };

  const options = createResponsiveChartOptions(
    isMobile, 
    "2025 Driver World Championship Standings",
    "driver"
  );

  return (
    <div>
      {createMobileDriverSelector(allDrivers, selectedDrivers, setSelectedDrivers)}
      
      <ResponsiveChartContainer title="2025 Driver World Championship Bump Chart">
        {chartData ? (
          <Line data={chartData} options={options} />
        ) : (
          <p>Loading chart...</p>
        )}
      </ResponsiveChartContainer>
    </div>
  );
};

export default DriverWDC2025Page;