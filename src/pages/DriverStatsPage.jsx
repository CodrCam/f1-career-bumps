import React, { useEffect, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import f1SeasonData from "../data/f1_2025_season.json";
import { parseDriverStats } from "../utils/parseDriverStats";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const teamColorMap = {
  McLaren: ["#FF8700", "#0057B8"],
  Mercedes: ["#00D2BE", "#C0C0C0"],
  "Red Bull Racing": ["#1E41FF", "#FF1E00"],
  Ferrari: ["#DC0000", "#FFD700"],
  Williams: ["#005AFF", "#00CFFF"],
  Alpine: ["#0090FF", "#FF69B4"],
  "Aston Martin": ["#00665E", "#D4AF37"],
  Haas: ["#B6BABD", "#FF0000"],
  "Racing Bulls": ["#4B6B8C", "#FF3C38"],
  "Kick Sauber": ["#00F500", "#000000"],
};

const DriverStatsPage = () => {
  const [teamStats, setTeamStats] = useState({});

  useEffect(() => {
    const parsed = parseDriverStats(f1SeasonData);
    const grouped = {};
    parsed.forEach((driver) => {
      if (!grouped[driver.team]) grouped[driver.team] = [];
      grouped[driver.team].push(driver);
    });
    setTeamStats(grouped);
  }, []);

  return (
    <div style={{ padding: "2rem" }}>
      <h1 style={{ textAlign: "center", fontSize: "2rem", marginBottom: "2rem" }}>
        2025 Composite Performance Breakdown
      </h1>

      {Object.entries(teamStats).map(([team, drivers]) => {
        if (drivers.length < 2) return null;

        const [d1, d2] = drivers;
        const [color1, color2] = teamColorMap[team] || ["#888", "#AAA"];

        const data = {
          labels: ["Points", "Qualifying", "Finish", "Head-to-Head"],
          datasets: [
            {
              label: d1.name,
              data: [d1.normPoints, d1.normQuali, d1.normFinish, d1.normHead],
              backgroundColor: color1,
            },
            {
              label: d2.name,
              data: [d2.normPoints, d2.normQuali, d2.normFinish, d2.normHead],
              backgroundColor: color2,
            },
          ],
        };

        const options = {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: {
              display: true,
              text: `${team} – Composite Metric Breakdown`,
            },
            legend: {
              position: "top",
            },
          },
          scales: {
            y: {
              beginAtZero: true,
              max: 1,
              ticks: {
                stepSize: 0.2,
              },
            },
          },
        };

        return (
          <div key={team} style={{ marginBottom: "4rem" }}>
            <div
              style={{
                height: "60vh",
                width: "100vw",
                padding: "2rem",
                boxSizing: "border-box",
              }}
            >
              <Bar data={data} options={options} />
            </div>
            <div style={{ maxWidth: "800px", margin: "0 auto", padding: "1rem" }}>
              <h3 style={{ textAlign: "center", marginBottom: "0.5rem" }}>Detailed Comparison</h3>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th>{d1.name}</th>
                    <th>{d2.name}</th>
                  </tr>
                </thead>
                <tbody>
                    <tr>
                      <td>Total Points</td>
                      <td>{d1.points}</td>
                      <td>{d2.points}</td>
                    </tr>
                    <tr>
                      <td>Average Qualifying</td>
                      <td>{d1.avgQuali?.toFixed(2)}</td>
                      <td>{d2.avgQuali?.toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td>Average Finish</td>
                      <td>{d1.avgFinish?.toFixed(2)}</td>
                      <td>{d2.avgFinish?.toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td>Head-to-Head Wins</td>
                      <td>{d1.headWins}</td>
                      <td>{d2.headWins}</td>
                    </tr>
                  </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default DriverStatsPage;
