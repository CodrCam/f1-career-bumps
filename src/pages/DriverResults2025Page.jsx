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

const DriverResults2025Page = () => {
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
      const standings = new Map();
      const raceRounds = [];

      const races = f1SeasonData.races || [];

      races.forEach((round) => {
        const { round: raceRound, race_results } = round;
        raceRounds.push(`R${raceRound}`);

        race_results.forEach(({ driver, position }) => {
          if (!standings.has(driver)) {
            standings.set(driver, []);
          }
          standings.get(driver).push(position);
        });

        for (const [driver, posArr] of standings.entries()) {
          if (posArr.length < raceRounds.length) {
            posArr.push(null);
          }
        }
      });

      const datasets = Array.from(standings.entries()).map(([driver, positions]) => {
        const team = races.find((r) =>
          r.race_results.some((res) => res.driver === driver)
        )?.race_results.find((res) => res.driver === driver)?.team;

        const isSelected =
          selectedDrivers.every((sel) => !sel) || selectedDrivers.includes(driver);

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

      setChartData({
        labels: raceRounds,
        datasets,
      });
    };

    buildChartData();
  }, [selectedDrivers, isMobile]);

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
            const round = f1SeasonData.races[raceIndex];
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
    <div>
      {createMobileDriverSelector(allDrivers, selectedDrivers, setSelectedDrivers)}
      
      <ResponsiveChartContainer title="2025 Driver Race Results Bump Chart">
        {chartData ? <Line data={chartData} options={options} /> : <p>Loading chart...</p>}
      </ResponsiveChartContainer>
    </div>
  );
};

export default DriverResults2025Page;