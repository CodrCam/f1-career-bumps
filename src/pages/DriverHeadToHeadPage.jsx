import React, { useState, useMemo } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  RadialLinearScale,
} from "chart.js";
import { Bar, Radar, Line } from "react-chartjs-2";
import f1SeasonData from "../data/f1_2025_season.json";
import { useProcessedRaceData, getAllDrivers } from "../utils/dataProcessing.js";
import { F1PageLayout, ResponsiveChart, StatsGrid } from "../components/ChartComponents.jsx";
import { ControlBar, ToggleSwitch } from "../components/UIControls.jsx";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  RadialLinearScale
);

// Enhanced driver color system
const getDriverColor = (driverName) => {
  const driverVariations = {
    'Max Verstappen': '#1E41FF',
    'Yuki Tsunoda': '#0F2080',
    'Charles Leclerc': '#DC0000',
    'Lewis Hamilton': '#B30000',
    'Lando Norris': '#FF8000',
    'Oscar Piastri': '#CC6600',
    'George Russell': '#00D2BE',
    'Kimi Antonelli': '#00B5A0',
    'Fernando Alonso': '#006F62',
    'Lance Stroll': '#004F45',
    'Pierre Gasly': '#FF69B4',
    'Franco Colapinto': '#CC4A8C',
    'Jack Doohan': '#AA3F75',
    'Alexander Albon': '#005AFF',
    'Carlos Sainz': '#0040CC',
    'Esteban Ocon': '#B6BABD',
    'Oliver Bearman': '#999C9F',
    'Isack Hadjar': '#ADD8E6',
    'Liam Lawson': '#8BC5E6',
    'Nico Hulkenberg': '#00FF00',
    'Gabriel Bortoleto': '#00CC00'
  };
  
  return driverVariations[driverName] || '#FFFFFF';
};

const parseTimeToSeconds = (time) => {
  if (!time || time === "No Time" || time === "DNF" || time === "DNS") return null;
  if (time.includes("lap")) return 9999;
  if (time.includes(":")) {
    const parts = time.replace("+", "").replace("s", "").split(":");
    if (parts.length === 2) {
      const [min, sec] = parts.map(parseFloat);
      return min * 60 + sec;
    }
    if (parts.length === 3) {
      const [hr, min, sec] = parts.map(parseFloat);
      return hr * 3600 + min * 60 + sec;
    }
  }
  return parseFloat(time.replace("+", "").replace("s", ""));
};

const isRelativeTime = (time) => typeof time === "string" && time.trim().startsWith("+");

const formatTimeDelta = (time1, time2) => {
  const t1 = parseTimeToSeconds(time1);
  const t2 = parseTimeToSeconds(time2);

  if (t1 === null || t2 === null) return "--";

  if (isRelativeTime(time1) && !isRelativeTime(time2)) return time1;
  if (!isRelativeTime(time1) && isRelativeTime(time2)) return `-${time2}`;

  const delta = (t1 - t2).toFixed(3);
  return `${delta > 0 ? "+" : ""}${delta}s`;
};

const getDriverResultsByRound = (driver, type = "race_results", processedRaces) => {
  return processedRaces.map((race) => {
    const result = race[type]?.find((r) => r.driver === driver);
    return {
      circuit: race.circuit.split(" ")[0],
      position: result?.position ?? null,
      points: result?.points ?? 0,
      time: result?.time ?? null,
    };
  });
};

const getQualifyingResultsByRound = (driver, processedRaces) => {
  return processedRaces.map((race) => {
    const result = race.qualifying_results?.find((q) => q.driver === driver);
    return {
      circuit: race.circuit.split(" ")[0],
      grid: result?.position ?? null,
      time: result?.time ?? null,
    };
  });
};

const getWinStyle = (val1, val2, isLowerBetter = true) => {
  if (val1 === null || val2 === null) return {};
  if (val1 === val2) return { color: "#888" };
  return (isLowerBetter ? val1 < val2 : val1 > val2)
    ? { color: "#10B981", fontWeight: "600" }
    : { color: "#EF4444", fontWeight: "600" };
};

const DriverHeadToHeadPage = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [showVisualization, setShowVisualization] = useState(true);
  const [comparisonType, setComparisonType] = useState('overview'); // 'overview', 'qualifying', 'sprint', 'race'

  // Use shared processing utility
  const processedRaces = useProcessedRaceData(f1SeasonData.races);
  
  // Memoize all drivers list
  const allDrivers = useMemo(() => getAllDrivers(processedRaces), [processedRaces]);

  const [driver1, setDriver1] = useState(allDrivers[0] || "");
  const [driver2, setDriver2] = useState(allDrivers[1] || "");

  // Helper functions defined before usage
  const calculateSummaryStats = (quali1, quali2, sprint1, sprint2, races1, races2) => {
    // Qualifying stats
    const qualiWins1 = quali1.filter((q1, i) => {
      const q2 = quali2[i];
      return q1.grid !== null && q2.grid !== null && q1.grid < q2.grid;
    }).length;

    const qualiWins2 = quali2.filter((q2, i) => {
      const q1 = quali1[i];
      return q1.grid !== null && q2.grid !== null && q2.grid < q1.grid;
    }).length;

    // Race stats
    const raceWins1 = races1.filter((r1, i) => {
      const r2 = races2[i];
      return r1.position !== null && r2.position !== null && r1.position < r2.position;
    }).length;

    const raceWins2 = races2.filter((r2, i) => {
      const r1 = races1[i];
      return r1.position !== null && r2.position !== null && r2.position < r1.position;
    }).length;

    // Points and averages
    const totalPoints1 = races1.reduce((sum, r) => sum + r.points, 0);
    const totalPoints2 = races2.reduce((sum, r) => sum + r.points, 0);

    const avgQuali1 = quali1.filter(q => q.grid !== null).reduce((sum, q, _, arr) => sum + q.grid / arr.length, 0);
    const avgQuali2 = quali2.filter(q => q.grid !== null).reduce((sum, q, _, arr) => sum + q.grid / arr.length, 0);

    const avgRace1 = races1.filter(r => r.position !== null).reduce((sum, r, _, arr) => sum + r.position / arr.length, 0);
    const avgRace2 = races2.filter(r => r.position !== null).reduce((sum, r, _, arr) => sum + r.position / arr.length, 0);

    return {
      driver1: {
        qualiWins: qualiWins1,
        raceWins: raceWins1,
        totalPoints: totalPoints1,
        avgQuali: avgQuali1,
        avgRace: avgRace1,
        pointsPerRace: totalPoints1 / races1.length
      },
      driver2: {
        qualiWins: qualiWins2,
        raceWins: raceWins2,
        totalPoints: totalPoints2,
        avgQuali: avgQuali2,
        avgRace: avgRace2,
        pointsPerRace: totalPoints2 / races2.length
      }
    };
  };

  const createComparisonChartData = (summary, driver1Name, driver2Name) => {
    if (!summary) return null;

    return {
      labels: ['Qualifying Wins', 'Race Wins', 'Total Points', 'Avg Qualifying', 'Avg Race Finish'],
      datasets: [
        {
          label: driver1Name,
          data: [
            summary.driver1.qualiWins,
            summary.driver1.raceWins,
            summary.driver1.totalPoints,
            20 - summary.driver1.avgQuali, // Invert for better visual (higher = better)
            20 - summary.driver1.avgRace
          ],
          backgroundColor: getDriverColor(driver1Name) + '80',
          borderColor: getDriverColor(driver1Name),
          borderWidth: 2
        },
        {
          label: driver2Name,
          data: [
            summary.driver2.qualiWins,
            summary.driver2.raceWins,
            summary.driver2.totalPoints,
            20 - summary.driver2.avgQuali,
            20 - summary.driver2.avgRace
          ],
          backgroundColor: getDriverColor(driver2Name) + '80',
          borderColor: getDriverColor(driver2Name),
          borderWidth: 2
        }
      ]
    };
  };

  const createProgressionData = (races1, races2, driver1Name, driver2Name) => {
    let cumulative1 = 0;
    let cumulative2 = 0;
    
    const progression1 = [0];
    const progression2 = [0];
    
    races1.forEach((race, index) => {
      cumulative1 += race.points;
      cumulative2 += races2[index].points;
      progression1.push(cumulative1);
      progression2.push(cumulative2);
    });

    return {
      labels: ['Pre-Season', ...races1.map((_, i) => `R${i + 1}`)],
      datasets: [
        {
          label: driver1Name,
          data: progression1,
          borderColor: getDriverColor(driver1Name),
          backgroundColor: getDriverColor(driver1Name) + '20',
          borderWidth: 3,
          pointRadius: 4,
          pointHoverRadius: 8,
          tension: 0.2,
          fill: false
        },
        {
          label: driver2Name,
          data: progression2,
          borderColor: getDriverColor(driver2Name),
          backgroundColor: getDriverColor(driver2Name) + '20',
          borderWidth: 3,
          pointRadius: 4,
          pointHoverRadius: 8,
          tension: 0.2,
          fill: false
        }
      ]
    };
  };

  // Enhanced data processing with additional metrics
  const enhancedComparisonData = useMemo(() => {
    if (!driver1 || !driver2 || processedRaces.length === 0) {
      return {
        quali1: [], quali2: [], sprint1: [], sprint2: [], races1: [], races2: [],
        summary: null, chartData: null, progressionData: null
      };
    }

    const quali1 = getQualifyingResultsByRound(driver1, processedRaces);
    const quali2 = getQualifyingResultsByRound(driver2, processedRaces);
    const sprint1 = getDriverResultsByRound(driver1, "sprint_results", processedRaces);
    const sprint2 = getDriverResultsByRound(driver2, "sprint_results", processedRaces);
    const races1 = getDriverResultsByRound(driver1, "race_results", processedRaces);
    const races2 = getDriverResultsByRound(driver2, "race_results", processedRaces);

    // Calculate comprehensive summary statistics
    const summary = calculateSummaryStats(quali1, quali2, sprint1, sprint2, races1, races2);
    
    // Create chart data for visualization
    const chartData = createComparisonChartData(summary, driver1, driver2);
    
    // Create progression data
    const progressionData = createProgressionData(races1, races2, driver1, driver2);

    return {
      quali1, quali2, sprint1, sprint2, races1, races2,
      summary, chartData, progressionData
    };
  }, [driver1, driver2, processedRaces]);

  // Enhanced statistics for stats grid
  const statsData = useMemo(() => {
    if (!enhancedComparisonData.summary) return [];

    const { summary } = enhancedComparisonData;
    
    return [
      {
        label: 'Qualifying Battle',
        value: `${summary.driver1.qualiWins} - ${summary.driver2.qualiWins}`,
        sublabel: `${driver1} vs ${driver2}`,
        color: summary.driver1.qualiWins > summary.driver2.qualiWins ? 'green' : 
               summary.driver1.qualiWins < summary.driver2.qualiWins ? 'red' : 'yellow'
      },
      {
        label: 'Race Battle',
        value: `${summary.driver1.raceWins} - ${summary.driver2.raceWins}`,
        sublabel: 'Head-to-Head Wins',
        color: summary.driver1.raceWins > summary.driver2.raceWins ? 'green' : 
               summary.driver1.raceWins < summary.driver2.raceWins ? 'red' : 'yellow'
      },
      {
        label: 'Points Gap',
        value: Math.abs(summary.driver1.totalPoints - summary.driver2.totalPoints).toString(),
        sublabel: 'Championship Points',
        color: 'blue'
      },
      {
        label: 'Avg Performance Gap',
        value: Math.abs(summary.driver1.avgRace - summary.driver2.avgRace).toFixed(1),
        sublabel: 'Race Position Difference',
        color: 'purple'
      }
    ];
  }, [enhancedComparisonData.summary, driver1, driver2]);

  // Chart options
  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: {
        display: true,
        text: 'Head-to-Head Performance Comparison',
        font: { size: isMobile ? 14 : 16 },
        color: 'white'
      },
      legend: {
        position: 'top',
        labels: { color: 'white' }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: 'white',
        bodyColor: 'white',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1
      }
    },
    scales: {
      x: {
        ticks: { 
          color: 'white',
          maxRotation: isMobile ? 45 : 0
        },
        grid: { color: 'rgba(255, 255, 255, 0.1)' }
      },
      y: {
        beginAtZero: true,
        ticks: { color: 'white' },
        grid: { color: 'rgba(255, 255, 255, 0.1)' }
      }
    }
  };

  const progressionOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: {
        display: true,
        text: 'Championship Points Progression',
        font: { size: isMobile ? 14 : 16 },
        color: 'white'
      },
      legend: {
        position: 'top',
        labels: { color: 'white' }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: 'white',
        bodyColor: 'white',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1
      }
    },
    scales: {
      x: {
        title: { display: true, text: 'Season Progression', color: 'white' },
        ticks: { color: 'white' },
        grid: { color: 'rgba(255, 255, 255, 0.1)' }
      },
      y: {
        title: { display: true, text: 'Cumulative Points', color: 'white' },
        beginAtZero: true,
        ticks: { color: 'white' },
        grid: { color: 'rgba(255, 255, 255, 0.1)' }
      }
    }
  };

  const { quali1, quali2, sprint1, sprint2, races1, races2 } = enhancedComparisonData;

  return (
    <F1PageLayout
      title="Enhanced Driver Head-to-Head Analysis"
      subtitle="Comprehensive statistical comparison between any two drivers across all sessions"
      className="enhanced-head-to-head"
    >
      {/* Enhanced Controls */}
      <ControlBar>
        <select 
          value={driver1} 
          onChange={(e) => setDriver1(e.target.value)}
          style={{
            padding: "0.75rem",
            fontSize: "1rem",
            borderRadius: "6px",
            border: "1px solid #555",
            backgroundColor: "#333",
            color: "#fff",
            minWidth: "200px"
          }}
        >
          {allDrivers.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>

        <div style={{ 
          padding: "0.75rem",
          fontSize: "1rem",
          color: "#fff",
          fontWeight: "bold"
        }}>
          VS
        </div>

        <select 
          value={driver2} 
          onChange={(e) => setDriver2(e.target.value)}
          style={{
            padding: "0.75rem",
            fontSize: "1rem",
            borderRadius: "6px",
            border: "1px solid #555",
            backgroundColor: "#333",
            color: "#fff",
            minWidth: "200px"
          }}
        >
          {allDrivers.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>

        <select
          value={comparisonType}
          onChange={(e) => setComparisonType(e.target.value)}
          style={{
            padding: "0.75rem",
            fontSize: "1rem",
            borderRadius: "6px",
            border: "1px solid #555",
            backgroundColor: "#333",
            color: "#fff"
          }}
        >
          <option value="overview">Overview</option>
          <option value="qualifying">Qualifying Focus</option>
          <option value="sprint">Sprint Focus</option>
          <option value="race">Race Focus</option>
        </select>

        <ToggleSwitch
          checked={showVisualization}
          onChange={(e) => setShowVisualization(e.target.checked)}
          label="Show Charts"
        />
      </ControlBar>

      {/* Statistics Grid */}
      <StatsGrid stats={statsData} className="head-to-head-stats" />

      {/* Visualization Charts */}
      {showVisualization && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
          gap: '2rem',
          marginBottom: '2rem'
        }}>
          {/* Performance Comparison Chart */}
          {enhancedComparisonData.chartData && (
            <div style={{
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '8px',
              padding: '1rem',
              height: '400px'
            }}>
              <Bar data={enhancedComparisonData.chartData} options={barChartOptions} />
            </div>
          )}

          {/* Points Progression Chart */}
          {enhancedComparisonData.progressionData && (
            <div style={{
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '8px',
              padding: '1rem',
              height: '400px'
            }}>
              <Line data={enhancedComparisonData.progressionData} options={progressionOptions} />
            </div>
          )}
        </div>
      )}

      {/* Enhanced Comparison Tables */}
      {(comparisonType === 'overview' || comparisonType === 'qualifying') && (
        <section style={{ marginBottom: '3rem' }}>
          <h2 style={{ 
            fontSize: isMobile ? '1.3rem' : '1.5rem',
            color: '#fff',
            marginBottom: '1rem',
            borderLeft: '4px solid #60A5FA',
            paddingLeft: '1rem'
          }}>
            🏁 Qualifying Head-to-Head
          </h2>
          {isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {quali1.map((q1, i) => {
                const q2 = quali2[i];
                const gridDelta = q1.grid !== null && q2.grid !== null ? q1.grid - q2.grid : null;
                return (
                  <div key={`q-${i}`} style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: '8px',
                    padding: '1.5rem',
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                  }}>
                    <h4 style={{ margin: '0 0 1rem 0', color: '#fff', fontSize: '1.1rem' }}>
                      {q1.circuit}
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div style={{
                        padding: '1rem',
                        backgroundColor: 'rgba(0, 0, 0, 0.3)',
                        borderRadius: '6px',
                        border: `2px solid ${getDriverColor(driver1)}`
                      }}>
                        <div style={{ fontSize: '0.9rem', color: '#ccc', marginBottom: '0.5rem' }}>{driver1}</div>
                        <div style={{ 
                          fontWeight: 'bold', 
                          fontSize: '1.1rem',
                          color: getWinStyle(q1.grid, q2.grid).color || '#fff' 
                        }}>
                          P{q1.grid} ({q1.time || "--"})
                        </div>
                      </div>
                      <div style={{
                        padding: '1rem',
                        backgroundColor: 'rgba(0, 0, 0, 0.3)',
                        borderRadius: '6px',
                        border: `2px solid ${getDriverColor(driver2)}`
                      }}>
                        <div style={{ fontSize: '0.9rem', color: '#ccc', marginBottom: '0.5rem' }}>{driver2}</div>
                        <div style={{ 
                          fontWeight: 'bold', 
                          fontSize: '1.1rem',
                          color: getWinStyle(q2.grid, q1.grid).color || '#fff' 
                        }}>
                          P{q2.grid} ({q2.time || "--"})
                        </div>
                      </div>
                    </div>
                    {gridDelta !== null && (
                      <div style={{ 
                        marginTop: '1rem', 
                        textAlign: 'center', 
                        fontSize: '0.9rem', 
                        color: '#aaa',
                        padding: '0.5rem',
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        borderRadius: '4px'
                      }}>
                        Gap: {gridDelta > 0 ? "+" : ""}{gridDelta} positions
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ 
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '8px',
              overflow: 'hidden'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}>
                    <th style={{ padding: '1rem', textAlign: 'left', color: '#fff', fontWeight: 'bold' }}>Track</th>
                    <th style={{ padding: '1rem', textAlign: 'left', color: getDriverColor(driver1), fontWeight: 'bold' }}>{driver1}</th>
                    <th style={{ padding: '1rem', textAlign: 'left', color: getDriverColor(driver2), fontWeight: 'bold' }}>{driver2}</th>
                    <th style={{ padding: '1rem', textAlign: 'center', color: '#fff', fontWeight: 'bold' }}>Grid Gap</th>
                    <th style={{ padding: '1rem', textAlign: 'center', color: '#fff', fontWeight: 'bold' }}>Time Gap</th>
                  </tr>
                </thead>
                <tbody>
                  {quali1.map((q1, i) => {
                    const q2 = quali2[i];
                    const gridDelta = q1.grid !== null && q2.grid !== null ? q1.grid - q2.grid : null;
                    return (
                      <tr key={`q-${i}`} style={{ 
                        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                        backgroundColor: i % 2 === 0 ? 'rgba(255, 255, 255, 0.02)' : 'transparent'
                      }}>
                        <td style={{ padding: '1rem', color: '#fff', fontWeight: '600' }}>{q1.circuit}</td>
                        <td style={{ 
                          padding: '1rem', 
                          ...getWinStyle(q1.grid, q2.grid),
                          color: getWinStyle(q1.grid, q2.grid).color || getDriverColor(driver1)
                        }}>
                          P{q1.grid} ({q1.time ?? "--"})
                        </td>
                        <td style={{ 
                          padding: '1rem', 
                          ...getWinStyle(q2.grid, q1.grid),
                          color: getWinStyle(q2.grid, q1.grid).color || getDriverColor(driver2)
                        }}>
                          P{q2.grid} ({q2.time ?? "--"})
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'center', color: '#ccc' }}>
                          {gridDelta !== null ? `${gridDelta > 0 ? "+" : ""}${gridDelta}` : "--"}
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'center', color: '#ccc' }}>
                          {formatTimeDelta(q1.time, q2.time)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Sprint Comparison */}
      {(comparisonType === 'overview' || comparisonType === 'sprint') && (
        <section style={{ marginBottom: '3rem' }}>
          <h2 style={{ 
            fontSize: isMobile ? '1.3rem' : '1.5rem',
            color: '#fff',
            marginBottom: '1rem',
            borderLeft: '4px solid #F59E0B',
            paddingLeft: '1rem'
          }}>
            ⚡ Sprint Race Head-to-Head
          </h2>
          {isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {sprint1.map((r1, i) => {
                const r2 = sprint2[i];
                const posDelta = r1.position !== null && r2.position !== null ? r1.position - r2.position : null;
                return (
                  <div key={`s-${i}`} style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: '8px',
                    padding: '1.5rem',
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                  }}>
                    <h4 style={{ margin: '0 0 1rem 0', color: '#fff', fontSize: '1.1rem' }}>
                      {r1.circuit}
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div style={{
                        padding: '1rem',
                        backgroundColor: 'rgba(0, 0, 0, 0.3)',
                        borderRadius: '6px',
                        border: `2px solid ${getDriverColor(driver1)}`
                      }}>
                        <div style={{ fontSize: '0.9rem', color: '#ccc', marginBottom: '0.5rem' }}>{driver1}</div>
                        <div style={{ 
                          fontWeight: 'bold', 
                          fontSize: '1.1rem',
                          color: getWinStyle(r1.position, r2.position).color || '#fff' 
                        }}>
                          P{r1.position} ({r1.time || "--"})
                        </div>
                      </div>
                      <div style={{
                        padding: '1rem',
                        backgroundColor: 'rgba(0, 0, 0, 0.3)',
                        borderRadius: '6px',
                        border: `2px solid ${getDriverColor(driver2)}`
                      }}>
                        <div style={{ fontSize: '0.9rem', color: '#ccc', marginBottom: '0.5rem' }}>{driver2}</div>
                        <div style={{ 
                          fontWeight: 'bold', 
                          fontSize: '1.1rem',
                          color: getWinStyle(r2.position, r1.position).color || '#fff' 
                        }}>
                          P{r2.position} ({r2.time || "--"})
                        </div>
                      </div>
                    </div>
                    {posDelta !== null && (
                      <div style={{ 
                        marginTop: '1rem', 
                        textAlign: 'center', 
                        fontSize: '0.9rem', 
                        color: '#aaa',
                        padding: '0.5rem',
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        borderRadius: '4px'
                      }}>
                        Gap: {posDelta > 0 ? "+" : ""}{posDelta} positions
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ 
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '8px',
              overflow: 'hidden'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}>
                    <th style={{ padding: '1rem', textAlign: 'left', color: '#fff', fontWeight: 'bold' }}>Track</th>
                    <th style={{ padding: '1rem', textAlign: 'left', color: getDriverColor(driver1), fontWeight: 'bold' }}>{driver1}</th>
                    <th style={{ padding: '1rem', textAlign: 'left', color: getDriverColor(driver2), fontWeight: 'bold' }}>{driver2}</th>
                    <th style={{ padding: '1rem', textAlign: 'center', color: '#fff', fontWeight: 'bold' }}>Position Gap</th>
                    <th style={{ padding: '1rem', textAlign: 'center', color: '#fff', fontWeight: 'bold' }}>Time Gap</th>
                  </tr>
                </thead>
                <tbody>
                  {sprint1.map((r1, i) => {
                    const r2 = sprint2[i];
                    const posDelta = r1.position !== null && r2.position !== null ? r1.position - r2.position : null;
                    return (
                      <tr key={`s-${i}`} style={{ 
                        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                        backgroundColor: i % 2 === 0 ? 'rgba(255, 255, 255, 0.02)' : 'transparent'
                      }}>
                        <td style={{ padding: '1rem', color: '#fff', fontWeight: '600' }}>{r1.circuit}</td>
                        <td style={{ 
                          padding: '1rem', 
                          ...getWinStyle(r1.position, r2.position),
                          color: getWinStyle(r1.position, r2.position).color || getDriverColor(driver1)
                        }}>
                          P{r1.position} ({r1.time ?? "--"})
                        </td>
                        <td style={{ 
                          padding: '1rem', 
                          ...getWinStyle(r2.position, r1.position),
                          color: getWinStyle(r2.position, r1.position).color || getDriverColor(driver2)
                        }}>
                          P{r2.position} ({r2.time ?? "--"})
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'center', color: '#ccc' }}>
                          {posDelta !== null ? `${posDelta > 0 ? "+" : ""}${posDelta}` : "--"}
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'center', color: '#ccc' }}>
                          {formatTimeDelta(r1.time, r2.time)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Race Results Comparison */}
      {(comparisonType === 'overview' || comparisonType === 'race') && (
        <section>
          <h2 style={{ 
            fontSize: isMobile ? '1.3rem' : '1.5rem',
            color: '#fff',
            marginBottom: '1rem',
            borderLeft: '4px solid #10B981',
            paddingLeft: '1rem'
          }}>
            🏆 Race Results Head-to-Head
          </h2>
          {isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {races1.map((r1, i) => {
                const r2 = races2[i];
                const posDelta = r1.position !== null && r2.position !== null ? r1.position - r2.position : null;
                return (
                  <div key={`r-${i}`} style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: '8px',
                    padding: '1.5rem',
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                  }}>
                    <h4 style={{ margin: '0 0 1rem 0', color: '#fff', fontSize: '1.1rem' }}>
                      {r1.circuit}
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div style={{
                        padding: '1rem',
                        backgroundColor: 'rgba(0, 0, 0, 0.3)',
                        borderRadius: '6px',
                        border: `2px solid ${getDriverColor(driver1)}`
                      }}>
                        <div style={{ fontSize: '0.9rem', color: '#ccc', marginBottom: '0.5rem' }}>{driver1}</div>
                        <div style={{ 
                          fontWeight: 'bold', 
                          fontSize: '1.1rem',
                          color: getWinStyle(r1.position, r2.position).color || '#fff' 
                        }}>
                          P{r1.position} ({r1.time || "--"})
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#aaa', marginTop: '0.5rem' }}>
                          {r1.points} points
                        </div>
                      </div>
                      <div style={{
                        padding: '1rem',
                        backgroundColor: 'rgba(0, 0, 0, 0.3)',
                        borderRadius: '6px',
                        border: `2px solid ${getDriverColor(driver2)}`
                      }}>
                        <div style={{ fontSize: '0.9rem', color: '#ccc', marginBottom: '0.5rem' }}>{driver2}</div>
                        <div style={{ 
                          fontWeight: 'bold', 
                          fontSize: '1.1rem',
                          color: getWinStyle(r2.position, r1.position).color || '#fff' 
                        }}>
                          P{r2.position} ({r2.time || "--"})
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#aaa', marginTop: '0.5rem' }}>
                          {r2.points} points
                        </div>
                      </div>
                    </div>
                    {posDelta !== null && (
                      <div style={{ 
                        marginTop: '1rem', 
                        textAlign: 'center', 
                        fontSize: '0.9rem', 
                        color: '#aaa',
                        padding: '0.5rem',
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        borderRadius: '4px'
                      }}>
                        Gap: {posDelta > 0 ? "+" : ""}{posDelta} positions
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ 
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '8px',
              overflow: 'hidden'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}>
                    <th style={{ padding: '1rem', textAlign: 'left', color: '#fff', fontWeight: 'bold' }}>Track</th>
                    <th style={{ padding: '1rem', textAlign: 'left', color: getDriverColor(driver1), fontWeight: 'bold' }}>{driver1}</th>
                    <th style={{ padding: '1rem', textAlign: 'left', color: getDriverColor(driver2), fontWeight: 'bold' }}>{driver2}</th>
                    <th style={{ padding: '1rem', textAlign: 'center', color: '#fff', fontWeight: 'bold' }}>Position Gap</th>
                    <th style={{ padding: '1rem', textAlign: 'center', color: '#fff', fontWeight: 'bold' }}>Time Gap</th>
                  </tr>
                </thead>
                <tbody>
                  {races1.map((r1, i) => {
                    const r2 = races2[i];
                    const posDelta = r1.position !== null && r2.position !== null ? r1.position - r2.position : null;
                    return (
                      <tr key={`r-${i}`} style={{ 
                        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                        backgroundColor: i % 2 === 0 ? 'rgba(255, 255, 255, 0.02)' : 'transparent'
                      }}>
                        <td style={{ padding: '1rem', color: '#fff', fontWeight: '600' }}>{r1.circuit}</td>
                        <td style={{ 
                          padding: '1rem', 
                          ...getWinStyle(r1.position, r2.position),
                          color: getWinStyle(r1.position, r2.position).color || getDriverColor(driver1)
                        }}>
                          P{r1.position} ({r1.time ?? "--"}) - {r1.points}pts
                        </td>
                        <td style={{ 
                          padding: '1rem', 
                          ...getWinStyle(r2.position, r1.position),
                          color: getWinStyle(r2.position, r1.position).color || getDriverColor(driver2)
                        }}>
                          P{r2.position} ({r2.time ?? "--"}) - {r2.points}pts
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'center', color: '#ccc' }}>
                          {posDelta !== null ? `${posDelta > 0 ? "+" : ""}${posDelta}` : "--"}
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'center', color: '#ccc' }}>
                          {formatTimeDelta(r1.time, r2.time)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Enhanced Summary */}
      <div style={{
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: '8px',
        padding: '2rem',
        marginTop: '2rem'
      }}>
        <h3 style={{ color: '#fff', marginBottom: '1rem' }}>📊 Enhanced Analysis Summary</h3>
        <div style={{ color: '#ccc', lineHeight: '1.6' }}>
          <p style={{ marginBottom: '1rem' }}>
            This comprehensive head-to-head analysis compares {driver1} and {driver2} across all session types with enhanced visualizations and statistical insights.
          </p>
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
            gap: '1.5rem'
          }}>
            <div>
              <h4 style={{ color: '#60A5FA', marginBottom: '0.5rem' }}>Performance Metrics:</h4>
              <ul style={{ listStyle: 'none', padding: 0 }}>
                <li>• <strong>Head-to-Head Records</strong>: Win/loss across sessions</li>
                <li>• <strong>Statistical Analysis</strong>: Average positions and gaps</li>
                <li>• <strong>Points Progression</strong>: Championship momentum</li>
                <li>• <strong>Session-Specific Focus</strong>: Detailed breakdowns</li>
              </ul>
            </div>
            <div>
              <h4 style={{ color: '#34D399', marginBottom: '0.5rem' }}>Visual Analysis:</h4>
              <ul style={{ listStyle: 'none', padding: 0 }}>
                <li>• <strong>Interactive Charts</strong>: Performance comparison visualization</li>
                <li>• <strong>Color Coding</strong>: Driver-specific color schemes</li>
                <li>• <strong>Responsive Design</strong>: Mobile-optimized tables and cards</li>
                <li>• <strong>Comprehensive Data</strong>: All sessions and statistics</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </F1PageLayout>
  );
};

export default DriverHeadToHeadPage;