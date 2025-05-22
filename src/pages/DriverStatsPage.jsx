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
import ResponsiveChartContainer from "../components/ResponsiveChartContainer";
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

  const isMobile = window.innerWidth < 768;

  return (
    <div style={{ padding: isMobile ? "1rem" : "2rem" }}>
      <h1 style={{ 
        textAlign: "center", 
        fontSize: isMobile ? "1.5rem" : "2rem", 
        marginBottom: "2rem" 
      }}>
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
              font: {
                size: isMobile ? 14 : 16
              }
            },
            legend: {
              position: isMobile ? "bottom" : "top",
            },
          },
          scales: {
            y: {
              beginAtZero: true,
              max: 1,
              ticks: {
                stepSize: 0.2,
                font: {
                  size: isMobile ? 10 : 12
                }
              },
            },
            x: {
              ticks: {
                font: {
                  size: isMobile ? 10 : 12
                }
              }
            }
          },
        };

        return (
          <div key={team} style={{ marginBottom: "4rem" }}>
            <ResponsiveChartContainer>
              <Bar data={data} options={options} />
            </ResponsiveChartContainer>
            
            <div style={{ 
              maxWidth: isMobile ? "100%" : "800px", 
              margin: "0 auto", 
              padding: "1rem",
              overflowX: isMobile ? "auto" : "visible"
            }}>
              <h3 style={{ 
                textAlign: "center", 
                marginBottom: "0.5rem",
                fontSize: isMobile ? "1.1rem" : "1.3rem"
              }}>
                Detailed Comparison
              </h3>
              
              {isMobile ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  <div style={{ 
                    backgroundColor: "#2a2a2a", 
                    padding: "1rem", 
                    borderRadius: "8px",
                    border: "1px solid #404040"
                  }}>
                    <h4 style={{ margin: "0 0 0.5rem 0", color: color1 }}>
                      {d1.name}
                    </h4>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", fontSize: "0.9rem" }}>
                      <div>Total Points: <strong>{d1.points}</strong></div>
                      <div>Avg Qualifying: <strong>{d1.avgQuali?.toFixed(2)}</strong></div>
                      <div>Avg Finish: <strong>{d1.avgFinish?.toFixed(2)}</strong></div>
                      <div>H2H Wins: <strong>{d1.headWins}</strong></div>
                    </div>
                  </div>
                  
                  <div style={{ 
                    backgroundColor: "#2a2a2a", 
                    padding: "1rem", 
                    borderRadius: "8px",
                    border: "1px solid #404040"
                  }}>
                    <h4 style={{ margin: "0 0 0.5rem 0", color: color2 }}>
                      {d2.name}
                    </h4>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", fontSize: "0.9rem" }}>
                      <div>Total Points: <strong>{d2.points}</strong></div>
                      <div>Avg Qualifying: <strong>{d2.avgQuali?.toFixed(2)}</strong></div>
                      <div>Avg Finish: <strong>{d2.avgFinish?.toFixed(2)}</strong></div>
                      <div>H2H Wins: <strong>{d2.headWins}</strong></div>
                    </div>
                  </div>
                </div>
              ) : (
                <table style={{ 
                  width: "100%", 
                  borderCollapse: "collapse", 
                  textAlign: "left",
                  backgroundColor: "#1a1a1a"
                }}>
                  <thead>
                    <tr style={{ backgroundColor: "#333" }}>
                      <th style={{ padding: "0.75rem", borderBottom: "1px solid #555" }}>Metric</th>
                      <th style={{ padding: "0.75rem", borderBottom: "1px solid #555" }}>{d1.name}</th>
                      <th style={{ padding: "0.75rem", borderBottom: "1px solid #555" }}>{d2.name}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid #333" }}>
                      <td style={{ padding: "0.75rem" }}>Total Points</td>
                      <td style={{ padding: "0.75rem" }}>{d1.points}</td>
                      <td style={{ padding: "0.75rem" }}>{d2.points}</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid #333" }}>
                      <td style={{ padding: "0.75rem" }}>Average Qualifying</td>
                      <td style={{ padding: "0.75rem" }}>{d1.avgQuali?.toFixed(2)}</td>
                      <td style={{ padding: "0.75rem" }}>{d2.avgQuali?.toFixed(2)}</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid #333" }}>
                      <td style={{ padding: "0.75rem" }}>Average Finish</td>
                      <td style={{ padding: "0.75rem" }}>{d1.avgFinish?.toFixed(2)}</td>
                      <td style={{ padding: "0.75rem" }}>{d2.avgFinish?.toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: "0.75rem" }}>Head-to-Head Wins</td>
                      <td style={{ padding: "0.75rem" }}>{d1.headWins}</td>
                      <td style={{ padding: "0.75rem" }}>{d2.headWins}</td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default DriverStatsPage;