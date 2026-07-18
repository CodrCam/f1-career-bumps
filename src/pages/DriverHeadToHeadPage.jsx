import React, { useEffect, useState, useMemo } from "react";
import { useParams } from "react-router-dom";
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
import { useSeasonData } from "../hooks/useSeasonData.js";
import { getSeasonFromParam } from "../utils/seasons.js";
import {
  getAllDrivers,
  getDriverColor as getSharedDriverColor,
  useProcessedRaceData,
} from "../utils/dataProcessing.js";
import { getTrackName } from "../utils/raceLabels.js";
import { F1PageLayout, SeasonDataState, StatsGrid } from "../components/ChartComponents.jsx";
import DriverMark from "../components/DriverMark.jsx";
import TeamLogo from "../components/TeamLogo.jsx";
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

const getDriverResultsByRound = (driver, type = "race_results", processedRaces) => {
  return processedRaces.map((race) => {
    const result = race[type]?.find((r) => r.driver === driver);
    return {
      circuit: getTrackName(race),
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
      circuit: getTrackName(race),
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

const NewDriverHeadToHeadPage = () => {
  const [isMobile] = useState(window.innerWidth < 768);
  const [showVisualization, setShowVisualization] = useState(true);
  const [viewMode, setViewMode] = useState('overview'); // 'overview', 'qualifying', 'sprint', 'race'
  const { seasonYear } = useParams();
  const selectedYear = getSeasonFromParam(seasonYear);
  const { races, status, error, retry } = useSeasonData(selectedYear);

  // Use shared processing utility
  const processedRaces = useProcessedRaceData(races);
  const getDriverColor = (driverName) => {
    const result = processedRaces
      .flatMap((race) => race.race_results ?? [])
      .find(({ driver }) => driver === driverName);

    return getSharedDriverColor(driverName, result?.team, selectedYear);
  };
  const getDriverTeam = (driverName) => processedRaces
    .flatMap((race) => race.race_results ?? [])
    .find(({ driver }) => driver === driverName)?.team;
  
  // Memoize all drivers list
  const allDrivers = useMemo(() => getAllDrivers(processedRaces), [processedRaces]);

  const [driver1, setDriver1] = useState(allDrivers[0] || "");
  const [driver2, setDriver2] = useState(allDrivers[1] || "");

  useEffect(() => {
    if (allDrivers.length > 0 && (!driver1 || !driver2)) {
      setDriver1((current) => current || allDrivers[0] || "");
      setDriver2((current) => current || allDrivers[1] || allDrivers[0] || "");
    }
  }, [allDrivers, driver1, driver2]);

  // Calculate comprehensive statistics
  const calculateComprehensiveStats = (quali1, quali2, sprint1, sprint2, races1, races2) => {
    // Head-to-head battles
    const qualiWins1 = quali1.filter((q1, i) => {
      const q2 = quali2[i];
      return q1.grid !== null && q2.grid !== null && q1.grid < q2.grid;
    }).length;

    const qualiWins2 = quali2.filter((q2, i) => {
      const q1 = quali1[i];
      return q1.grid !== null && q2.grid !== null && q2.grid < q1.grid;
    }).length;

    const raceWins1 = races1.filter((r1, i) => {
      const r2 = races2[i];
      return r1.position !== null && r2.position !== null && r1.position < r2.position;
    }).length;

    const raceWins2 = races2.filter((r2, i) => {
      const r1 = races1[i];
      return r1.position !== null && r2.position !== null && r2.position < r1.position;
    }).length;

    // Points calculation including sprint points
    const racePoints1 = races1.reduce((sum, r) => sum + r.points, 0);
    const racePoints2 = races2.reduce((sum, r) => sum + r.points, 0);
    const sprintPoints1 = sprint1.reduce((sum, s) => sum + s.points, 0);
    const sprintPoints2 = sprint2.reduce((sum, s) => sum + s.points, 0);
    const totalPoints1 = racePoints1 + sprintPoints1;
    const totalPoints2 = racePoints2 + sprintPoints2;

    // Average positions
    const validQuali1 = quali1.filter(q => q.grid !== null);
    const validQuali2 = quali2.filter(q => q.grid !== null);
    const avgQuali1 = validQuali1.length > 0 ? validQuali1.reduce((sum, q) => sum + q.grid, 0) / validQuali1.length : 0;
    const avgQuali2 = validQuali2.length > 0 ? validQuali2.reduce((sum, q) => sum + q.grid, 0) / validQuali2.length : 0;

    const validRaces1 = races1.filter(r => r.position !== null);
    const validRaces2 = races2.filter(r => r.position !== null);
    const avgRace1 = validRaces1.length > 0 ? validRaces1.reduce((sum, r) => sum + r.position, 0) / validRaces1.length : 0;
    const avgRace2 = validRaces2.length > 0 ? validRaces2.reduce((sum, r) => sum + r.position, 0) / validRaces2.length : 0;

    // Sprint battles
    const sprintWins1 = sprint1.filter((s1, i) => {
      const s2 = sprint2[i];
      return s1.position !== null && s2.position !== null && s1.position < s2.position;
    }).length;

    const sprintWins2 = sprint2.filter((s2, i) => {
      const s1 = sprint1[i];
      return s1.position !== null && s2.position !== null && s2.position < s1.position;
    }).length;

    return {
      driver1: {
        qualiWins: qualiWins1,
        raceWins: raceWins1,
        sprintWins: sprintWins1,
        totalPoints: totalPoints1,
        racePoints: racePoints1,
        sprintPoints: sprintPoints1,
        avgQuali: avgQuali1,
        avgRace: avgRace1,
        pointsPerRace: totalPoints1 / races1.length
      },
      driver2: {
        qualiWins: qualiWins2,
        raceWins: raceWins2,
        sprintWins: sprintWins2,
        totalPoints: totalPoints2,
        racePoints: racePoints2,
        sprintPoints: sprintPoints2,
        avgQuali: avgQuali2,
        avgRace: avgRace2,
        pointsPerRace: totalPoints2 / races2.length
      }
    };
  };

  const createRadarChartData = (stats, driver1Name, driver2Name) => {
    if (!stats) return null;

    return {
      labels: ['Qualifying Battles', 'Race Battles', 'Sprint Battles', 'Total Points', 'Avg Qualifying', 'Avg Race Finish'],
      datasets: [
        {
          label: driver1Name,
          data: [
            stats.driver1.qualiWins,
            stats.driver1.raceWins,
            stats.driver1.sprintWins,
            Math.round(stats.driver1.totalPoints / 10), // Scale points for radar
            Math.max(0, 20 - stats.driver1.avgQuali), // Invert for better visual
            Math.max(0, 20 - stats.driver1.avgRace)
          ],
          backgroundColor: getDriverColor(driver1Name) + '40',
          borderColor: getDriverColor(driver1Name),
          borderWidth: 2,
          pointBackgroundColor: getDriverColor(driver1Name),
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: getDriverColor(driver1Name)
        },
        {
          label: driver2Name,
          data: [
            stats.driver2.qualiWins,
            stats.driver2.raceWins,
            stats.driver2.sprintWins,
            Math.round(stats.driver2.totalPoints / 10),
            Math.max(0, 20 - stats.driver2.avgQuali),
            Math.max(0, 20 - stats.driver2.avgRace)
          ],
          backgroundColor: getDriverColor(driver2Name) + '40',
          borderColor: getDriverColor(driver2Name),
          borderWidth: 2,
          pointBackgroundColor: getDriverColor(driver2Name),
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: getDriverColor(driver2Name)
        }
      ]
    };
  };

  const createPointsProgressionData = (races1, races2, sprint1, sprint2, driver1Name, driver2Name) => {
    let cumulative1 = 0;
    let cumulative2 = 0;
    
    const progression1 = [0];
    const progression2 = [0];
    
    races1.forEach((race, index) => {
      const racePoints1 = race.points;
      const racePoints2 = races2[index].points;
      const sprintPoints1 = sprint1[index] ? sprint1[index].points : 0;
      const sprintPoints2 = sprint2[index] ? sprint2[index].points : 0;
      
      cumulative1 += racePoints1 + sprintPoints1;
      cumulative2 += racePoints2 + sprintPoints2;
      
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
          pointRadius: 5,
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
          pointRadius: 5,
          pointHoverRadius: 8,
          tension: 0.2,
          fill: false
        }
      ]
    };
  };

  // Main data processing
  const comparisonData = useMemo(() => {
    if (!driver1 || !driver2 || processedRaces.length === 0) {
      return {
        quali1: [], quali2: [], sprint1: [], sprint2: [], races1: [], races2: [],
        stats: null, radarData: null, progressionData: null
      };
    }

    const quali1 = getQualifyingResultsByRound(driver1, processedRaces);
    const quali2 = getQualifyingResultsByRound(driver2, processedRaces);
    const sprint1 = getDriverResultsByRound(driver1, "sprint_results", processedRaces);
    const sprint2 = getDriverResultsByRound(driver2, "sprint_results", processedRaces);
    const races1 = getDriverResultsByRound(driver1, "race_results", processedRaces);
    const races2 = getDriverResultsByRound(driver2, "race_results", processedRaces);

    const stats = calculateComprehensiveStats(quali1, quali2, sprint1, sprint2, races1, races2);
    const radarData = createRadarChartData(stats, driver1, driver2);
    const progressionData = createPointsProgressionData(races1, races2, sprint1, sprint2, driver1, driver2);

    return {
      quali1, quali2, sprint1, sprint2, races1, races2,
      stats, radarData, progressionData
    };
  }, [driver1, driver2, processedRaces]);

  // Statistics for the grid
  const statsGridData = useMemo(() => {
    if (!comparisonData.stats) return [];

    const { stats } = comparisonData;
    
    return [
      {
        label: 'Head-to-Head Record',
        value: `${stats.driver1.qualiWins + stats.driver1.raceWins + stats.driver1.sprintWins} - ${stats.driver2.qualiWins + stats.driver2.raceWins + stats.driver2.sprintWins}`,
        sublabel: 'Total Battles Won',
        color: (stats.driver1.qualiWins + stats.driver1.raceWins + stats.driver1.sprintWins) > 
               (stats.driver2.qualiWins + stats.driver2.raceWins + stats.driver2.sprintWins) ? 'green' : 
               (stats.driver1.qualiWins + stats.driver1.raceWins + stats.driver1.sprintWins) < 
               (stats.driver2.qualiWins + stats.driver2.raceWins + stats.driver2.sprintWins) ? 'red' : 'yellow'
      },
      {
        label: 'Championship Points Gap',
        value: Math.abs(stats.driver1.totalPoints - stats.driver2.totalPoints).toString(),
        sublabel: 'Total Points Difference',
        color: 'blue'
      },
      {
        label: 'Qualifying Battle',
        value: `${stats.driver1.qualiWins} - ${stats.driver2.qualiWins}`,
        sublabel: `${driver1} vs ${driver2}`,
        color: stats.driver1.qualiWins > stats.driver2.qualiWins ? 'green' : 
               stats.driver1.qualiWins < stats.driver2.qualiWins ? 'red' : 'yellow'
      },
      {
        label: 'Race Battle',
        value: `${stats.driver1.raceWins} - ${stats.driver2.raceWins}`,
        sublabel: 'Sunday Performance',
        color: stats.driver1.raceWins > stats.driver2.raceWins ? 'green' : 
               stats.driver1.raceWins < stats.driver2.raceWins ? 'red' : 'yellow'
      },
      {
        label: 'Sprint Battle',
        value: `${stats.driver1.sprintWins} - ${stats.driver2.sprintWins}`,
        sublabel: 'Saturday Sprint',
        color: stats.driver1.sprintWins > stats.driver2.sprintWins ? 'green' : 
               stats.driver1.sprintWins < stats.driver2.sprintWins ? 'red' : 'yellow'
      },
      {
        label: 'Points Per Race',
        value: `${stats.driver1.pointsPerRace.toFixed(1)} vs ${stats.driver2.pointsPerRace.toFixed(1)}`,
        sublabel: 'Average Points Scored',
        color: 'purple'
      }
    ];
  }, [comparisonData, driver1, driver2]);

  // Chart options
  const radarChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: {
        display: true,
        text: 'Performance Comparison Radar',
        font: { size: isMobile ? 14 : 16 },
        color: 'white'
      },
      legend: {
        position: 'top',
        labels: { color: 'white' }
      }
    },
    scales: {
      r: {
        beginAtZero: true,
        grid: { color: 'rgba(255, 255, 255, 0.1)' },
        angleLines: { color: 'rgba(255, 255, 255, 0.1)' },
        ticks: { color: 'white', backdropColor: 'transparent' },
        pointLabels: { color: 'white', font: { size: isMobile ? 10 : 12 } }
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

  const { quali1, quali2, sprint1, sprint2, races1, races2 } = comparisonData;

  if (races.length === 0) {
    return (
      <F1PageLayout
        title="Driver Head-to-Head Analysis"
        subtitle="Comprehensive statistical comparison between drivers across all sessions"
        className="driver-head-to-head"
      >
        <SeasonDataState
          status={status}
          error={error}
          onRetry={retry}
        />
      </F1PageLayout>
    );
  }

  return (
    <F1PageLayout
      title="Driver Head-to-Head Analysis"
      subtitle="Comprehensive statistical comparison between drivers across all sessions"
      className="driver-head-to-head"
    >
      {/* Controls */}
      <ControlBar>
        <div className="driver-comparison-pick">
          <DriverMark
            driver={driver1}
            size="sm"
            team={getDriverTeam(driver1)}
            year={selectedYear}
          />
          <TeamLogo
            size="xs"
            team={getDriverTeam(driver1)}
            tone="team"
            year={selectedYear}
          />
          <select
            aria-label="First driver"
            value={driver1}
            onChange={(e) => setDriver1(e.target.value)}
            style={{
              padding: "0.75rem",
              fontSize: "1rem",
              borderRadius: "6px",
              border: "1px solid #555",
              backgroundColor: "#333",
              color: "#fff",
              minWidth: "180px"
            }}
          >
            {allDrivers.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        <div style={{ 
          padding: "0.75rem",
          fontSize: "1.2rem",
          color: "#fff",
          fontWeight: "bold"
        }}>
          VS
        </div>

        <div className="driver-comparison-pick">
          <DriverMark
            driver={driver2}
            size="sm"
            team={getDriverTeam(driver2)}
            year={selectedYear}
          />
          <TeamLogo
            size="xs"
            team={getDriverTeam(driver2)}
            tone="team"
            year={selectedYear}
          />
          <select
            aria-label="Second driver"
            value={driver2}
            onChange={(e) => setDriver2(e.target.value)}
            style={{
              padding: "0.75rem",
              fontSize: "1rem",
              borderRadius: "6px",
              border: "1px solid #555",
              backgroundColor: "#333",
              color: "#fff",
              minWidth: "180px"
            }}
          >
            {allDrivers.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        <select
          value={viewMode}
          onChange={(e) => setViewMode(e.target.value)}
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
      <StatsGrid stats={statsGridData} className="head-to-head-stats" />

      {/* Visualization Charts */}
      {showVisualization && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
          gap: '2rem',
          marginBottom: '2rem'
        }}>
          {/* Radar Chart */}
          {comparisonData.radarData && (
            <div style={{
              backgroundColor: 'rgba(17, 20, 25, 0.98)',
              borderRadius: '8px',
              padding: '1rem',
              height: '400px'
            }}>
              <Radar data={comparisonData.radarData} options={radarChartOptions} />
            </div>
          )}

          {/* Points Progression */}
          {comparisonData.progressionData && (
            <div style={{
              backgroundColor: 'rgba(17, 20, 25, 0.98)',
              borderRadius: '8px',
              padding: '1rem',
              height: '400px'
            }}>
              <Line data={comparisonData.progressionData} options={progressionOptions} />
            </div>
          )}
        </div>
      )}

      {/* Detailed Comparisons */}
      {(viewMode === 'overview' || viewMode === 'qualifying') && (
        <section style={{ marginBottom: '2rem' }}>
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
                return (
                  <div key={`q-${i}`} style={{
                    backgroundColor: 'rgba(17, 20, 25, 0.98)',
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
                          P{q1.grid || "--"} ({q1.time || "--"})
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
                          P{q2.grid || "--"} ({q2.time || "--"})
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ 
              backgroundColor: 'rgba(17, 20, 25, 0.98)',
              borderRadius: '8px',
              overflow: 'hidden'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}>
                    <th style={{ padding: '1rem', textAlign: 'left', color: '#fff', fontWeight: 'bold' }}>Track</th>
                    <th style={{ padding: '1rem', textAlign: 'left', color: getDriverColor(driver1), fontWeight: 'bold' }}>{driver1}</th>
                    <th style={{ padding: '1rem', textAlign: 'left', color: getDriverColor(driver2), fontWeight: 'bold' }}>{driver2}</th>
                    <th style={{ padding: '1rem', textAlign: 'center', color: '#fff', fontWeight: 'bold' }}>Winner</th>
                  </tr>
                </thead>
                <tbody>
                  {quali1.map((q1, i) => {
                    const q2 = quali2[i];
                    const winner = q1.grid !== null && q2.grid !== null ? 
                      (q1.grid < q2.grid ? driver1 : q1.grid > q2.grid ? driver2 : 'Tie') : '--';
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
                          P{q1.grid || "--"} ({q1.time || "--"})
                        </td>
                        <td style={{ 
                          padding: '1rem', 
                          ...getWinStyle(q2.grid, q1.grid),
                          color: getWinStyle(q2.grid, q1.grid).color || getDriverColor(driver2)
                        }}>
                          P{q2.grid || "--"} ({q2.time || "--"})
                        </td>
                        <td style={{ 
                          padding: '1rem', 
                          textAlign: 'center', 
                          color: winner === driver1 ? getDriverColor(driver1) : 
                                 winner === driver2 ? getDriverColor(driver2) : '#ccc',
                          fontWeight: 'bold'
                        }}>
                          {winner}
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

      {/* Sprint Results */}
      {(viewMode === 'overview' || viewMode === 'sprint') && (
        <section style={{ marginBottom: '2rem' }}>
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
              {sprint1.map((s1, i) => {
                const s2 = sprint2[i];
                if (!s1.position && !s2.position) return null; // Skip if no sprint
                return (
                  <div key={`s-${i}`} style={{
                    backgroundColor: 'rgba(17, 20, 25, 0.98)',
                    borderRadius: '8px',
                    padding: '1.5rem',
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                  }}>
                    <h4 style={{ margin: '0 0 1rem 0', color: '#fff', fontSize: '1.1rem' }}>
                      {s1.circuit}
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
                          color: getWinStyle(s1.position, s2.position).color || '#fff' 
                        }}>
                          {s1.position ? `P${s1.position}` : "DNF"} - {s1.points}pts
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
                          color: getWinStyle(s2.position, s1.position).color || '#fff' 
                        }}>
                          {s2.position ? `P${s2.position}` : "DNF"} - {s2.points}pts
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ 
              backgroundColor: 'rgba(17, 20, 25, 0.98)',
              borderRadius: '8px',
              overflow: 'hidden'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}>
                    <th style={{ padding: '1rem', textAlign: 'left', color: '#fff', fontWeight: 'bold' }}>Track</th>
                    <th style={{ padding: '1rem', textAlign: 'left', color: getDriverColor(driver1), fontWeight: 'bold' }}>{driver1}</th>
                    <th style={{ padding: '1rem', textAlign: 'left', color: getDriverColor(driver2), fontWeight: 'bold' }}>{driver2}</th>
                    <th style={{ padding: '1rem', textAlign: 'center', color: '#fff', fontWeight: 'bold' }}>Winner</th>
                  </tr>
                </thead>
                <tbody>
                  {sprint1.map((s1, i) => {
                    const s2 = sprint2[i];
                    if (!s1.position && !s2.position) return null;
                    const winner = s1.position !== null && s2.position !== null ? 
                      (s1.position < s2.position ? driver1 : s1.position > s2.position ? driver2 : 'Tie') : '--';
                    return (
                      <tr key={`s-${i}`} style={{ 
                        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                        backgroundColor: i % 2 === 0 ? 'rgba(255, 255, 255, 0.02)' : 'transparent'
                      }}>
                        <td style={{ padding: '1rem', color: '#fff', fontWeight: '600' }}>{s1.circuit}</td>
                        <td style={{ 
                          padding: '1rem', 
                          ...getWinStyle(s1.position, s2.position),
                          color: getWinStyle(s1.position, s2.position).color || getDriverColor(driver1)
                        }}>
                          {s1.position ? `P${s1.position}` : "DNF"} - {s1.points}pts
                        </td>
                        <td style={{ 
                          padding: '1rem', 
                          ...getWinStyle(s2.position, s1.position),
                          color: getWinStyle(s2.position, s1.position).color || getDriverColor(driver2)
                        }}>
                          {s2.position ? `P${s2.position}` : "DNF"} - {s2.points}pts
                        </td>
                        <td style={{ 
                          padding: '1rem', 
                          textAlign: 'center', 
                          color: winner === driver1 ? getDriverColor(driver1) : 
                                 winner === driver2 ? getDriverColor(driver2) : '#ccc',
                          fontWeight: 'bold'
                        }}>
                          {winner}
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

      {/* Race Results */}
      {(viewMode === 'overview' || viewMode === 'race') && (
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
                return (
                  <div key={`r-${i}`} style={{
                    backgroundColor: 'rgba(17, 20, 25, 0.98)',
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
                          {r1.position ? `P${r1.position}` : "DNF"} - {r1.points}pts
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#aaa', marginTop: '0.5rem' }}>
                          {r1.time || "--"}
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
                          {r2.position ? `P${r2.position}` : "DNF"} - {r2.points}pts
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#aaa', marginTop: '0.5rem' }}>
                          {r2.time || "--"}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ 
              backgroundColor: 'rgba(17, 20, 25, 0.98)',
              borderRadius: '8px',
              overflow: 'hidden'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}>
                    <th style={{ padding: '1rem', textAlign: 'left', color: '#fff', fontWeight: 'bold' }}>Track</th>
                    <th style={{ padding: '1rem', textAlign: 'left', color: getDriverColor(driver1), fontWeight: 'bold' }}>{driver1}</th>
                    <th style={{ padding: '1rem', textAlign: 'left', color: getDriverColor(driver2), fontWeight: 'bold' }}>{driver2}</th>
                    <th style={{ padding: '1rem', textAlign: 'center', color: '#fff', fontWeight: 'bold' }}>Winner</th>
                  </tr>
                </thead>
                <tbody>
                  {races1.map((r1, i) => {
                    const r2 = races2[i];
                    const winner = r1.position !== null && r2.position !== null ? 
                      (r1.position < r2.position ? driver1 : r1.position > r2.position ? driver2 : 'Tie') : '--';
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
                          {r1.position ? `P${r1.position}` : "DNF"} - {r1.points}pts ({r1.time || "--"})
                        </td>
                        <td style={{ 
                          padding: '1rem', 
                          ...getWinStyle(r2.position, r1.position),
                          color: getWinStyle(r2.position, r1.position).color || getDriverColor(driver2)
                        }}>
                          {r2.position ? `P${r2.position}` : "DNF"} - {r2.points}pts ({r2.time || "--"})
                        </td>
                        <td style={{ 
                          padding: '1rem', 
                          textAlign: 'center', 
                          color: winner === driver1 ? getDriverColor(driver1) : 
                                 winner === driver2 ? getDriverColor(driver2) : '#ccc',
                          fontWeight: 'bold'
                        }}>
                          {winner}
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
    </F1PageLayout>
  );
};

export default NewDriverHeadToHeadPage;
