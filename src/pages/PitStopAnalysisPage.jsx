import React, { useState, useMemo, useEffect } from 'react';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import pitStopData from '../data/Fastest_PitStop.json';
import { getTeamColor } from '../utils/dataProcessing.js';
import { F1PageLayout } from '../components/ChartComponents.jsx';
import { ControlBar, ToggleSwitch } from '../components/UIControls.jsx';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

const PitStopAnalysisPage = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [showPredictions, setShowPredictions] = useState(true);
  const [analysisType, setAnalysisType] = useState('team'); // 'team' or 'driver'

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Process pit stop data for analysis
  const processedData = useMemo(() => {
    const teamStats = new Map();
    const driverStats = new Map();
    const roundData = [];
    const allTeams = new Set();
    const allDrivers = new Set();

    // Process each round
    pitStopData.forEach(round => {
      const roundInfo = {
        round: round.round,
        grandPrix: round.grand_prix,
        fastest: round.fastest_pit_stops[0],
        top3Teams: round.fastest_pit_stops.slice(0, 3).map(ps => ps.team),
        averageTime: round.fastest_pit_stops.reduce((sum, ps) => sum + ps.time, 0) / round.fastest_pit_stops.length
      };
      roundData.push(roundInfo);

      // Process team and driver stats
      round.fastest_pit_stops.forEach((pitStop, index) => {
        const { team, driver, time, position } = pitStop;
        allTeams.add(team);
        allDrivers.add(driver);

        // Team stats
        if (!teamStats.has(team)) {
          teamStats.set(team, {
            appearances: 0,
            totalTime: 0,
            bestTime: Infinity,
            worstTime: 0,
            top3Count: 0,
            winCount: 0,
            averagePosition: 0,
            positionSum: 0,
            predictiveScore: 0
          });
        }
        const teamStat = teamStats.get(team);
        teamStat.appearances++;
        teamStat.totalTime += time;
        teamStat.bestTime = Math.min(teamStat.bestTime, time);
        teamStat.worstTime = Math.max(teamStat.worstTime, time);
        teamStat.positionSum += position;
        if (position <= 3) teamStat.top3Count++;
        if (position === 1) teamStat.winCount++;

        // Driver stats
        if (!driverStats.has(driver)) {
          driverStats.set(driver, {
            team,
            appearances: 0,
            totalTime: 0,
            bestTime: Infinity,
            averagePosition: 0,
            positionSum: 0,
            top3Count: 0,
            winCount: 0
          });
        }
        const driverStat = driverStats.get(driver);
        driverStat.appearances++;
        driverStat.totalTime += time;
        driverStat.bestTime = Math.min(driverStat.bestTime, time);
        driverStat.positionSum += position;
        if (position <= 3) driverStat.top3Count++;
        if (position === 1) driverStat.winCount++;
      });
    });

    // Calculate averages and predictive scores
    teamStats.forEach((stats, team) => {
      stats.averageTime = stats.totalTime / stats.appearances;
      stats.averagePosition = stats.positionSum / stats.appearances;
      
      // Predictive score based on consistency, speed, and recent performance
      const consistencyScore = (stats.appearances / pitStopData.length) * 30; // 30% weight
      const speedScore = (3.0 - stats.averageTime) * 20; // 20% weight (faster = higher score)
      const positionScore = (11 - stats.averagePosition) * 25; // 25% weight
      const winScore = (stats.winCount / stats.appearances) * 25; // 25% weight
      
      stats.predictiveScore = Math.max(0, consistencyScore + speedScore + positionScore + winScore);
    });

    driverStats.forEach((stats, driver) => {
      stats.averageTime = stats.totalTime / stats.appearances;
      stats.averagePosition = stats.positionSum / stats.appearances;
    });

    return {
      teamStats,
      driverStats,
      roundData,
      allTeams: Array.from(allTeams),
      allDrivers: Array.from(allDrivers)
    };
  }, []);

  // Team performance over time chart
  const teamTrendData = useMemo(() => {
    if (!selectedTeam) return null;

    const teamData = [];
    const rounds = [];

    pitStopData.forEach(round => {
      const teamPitStop = round.fastest_pit_stops.find(ps => ps.team === selectedTeam);
      rounds.push(`R${round.round}`);
      teamData.push(teamPitStop ? teamPitStop.time : null);
    });

    return {
      labels: rounds,
      datasets: [{
        label: `${selectedTeam} Pit Stop Times`,
        data: teamData,
        borderColor: getTeamColor(selectedTeam),
        backgroundColor: getTeamColor(selectedTeam),
        tension: 0.3,
        spanGaps: false,
        pointRadius: 4,
        pointHoverRadius: 6
      }]
    };
  }, [selectedTeam]);

  // Predictive ranking chart
  const predictionData = useMemo(() => {
    const sortedTeams = Array.from(processedData.teamStats.entries())
      .sort((a, b) => b[1].predictiveScore - a[1].predictiveScore)
      .slice(0, 10);

    return {
      labels: sortedTeams.map(([team]) => team),
      datasets: [{
        label: 'Predictive Score',
        data: sortedTeams.map(([, stats]) => stats.predictiveScore.toFixed(1)),
        backgroundColor: sortedTeams.map(([team]) => getTeamColor(team)),
        borderColor: sortedTeams.map(([team]) => getTeamColor(team)),
        borderWidth: 1
      }]
    };
  }, [processedData]);

  // Team consistency pie chart
  const consistencyData = useMemo(() => {
    const teamAppearances = Array.from(processedData.teamStats.entries())
      .map(([team, stats]) => ({ team, appearances: stats.appearances }))
      .sort((a, b) => b.appearances - a.appearances)
      .slice(0, 8);

    return {
      labels: teamAppearances.map(item => item.team),
      datasets: [{
        data: teamAppearances.map(item => item.appearances),
        backgroundColor: teamAppearances.map(item => getTeamColor(item.team)),
        borderWidth: 2,
        borderColor: '#333'
      }]
    };
  }, [processedData]);

  // Chart options
  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: {
        display: true,
        text: `${selectedTeam} Pit Stop Performance Trend`,
        font: { size: isMobile ? 14 : 16 }
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            return context.raw ? `${context.raw.toFixed(2)}s` : 'Not in top 10';
          }
        }
      }
    },
    scales: {
      y: {
        title: {
          display: true,
          text: 'Pit Stop Time (seconds)'
        },
        min: 2.0,
        max: 3.5
      }
    }
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: {
        display: true,
        text: 'Next Race Fastest Pit Stop Predictions',
        font: { size: isMobile ? 14 : 16 }
      },
      tooltip: {
        callbacks: {
          label: (context) => `Score: ${context.raw}`
        }
      }
    },
    scales: {
      y: {
        title: {
          display: true,
          text: 'Predictive Score'
        },
        beginAtZero: true
      }
    }
  };

  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: {
        display: true,
        text: 'Top 10 Appearances by Team',
        font: { size: isMobile ? 14 : 16 }
      },
      tooltip: {
        callbacks: {
          label: (context) => `${context.label}: ${context.raw} times`
        }
      }
    }
  };

  // Get top predictions
  const topPredictions = Array.from(processedData.teamStats.entries())
    .sort((a, b) => b[1].predictiveScore - a[1].predictiveScore)
    .slice(0, 5);

  return (
    <F1PageLayout
      title="F1 Pit Stop Analysis & Predictions"
      subtitle="Data-driven insights and next race predictions based on 2025 season performance"
      className="pit-stop-analysis"
    >
      {/* Controls */}
      <ControlBar>
        <select
          value={selectedTeam}
          onChange={(e) => setSelectedTeam(e.target.value)}
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
          <option value="">Select team for trend analysis</option>
          {processedData.allTeams.map(team => (
            <option key={team} value={team}>{team}</option>
          ))}
        </select>

        <ToggleSwitch
          checked={showPredictions}
          onChange={(e) => setShowPredictions(e.target.checked)}
          label="Show Predictions"
        />

        <select
          value={analysisType}
          onChange={(e) => setAnalysisType(e.target.value)}
          style={{
            padding: "0.75rem",
            fontSize: "1rem",
            borderRadius: "6px",
            border: "1px solid #555",
            backgroundColor: "#333",
            color: "#fff"
          }}
        >
          <option value="team">Team Analysis</option>
          <option value="driver">Driver Analysis</option>
        </select>
      </ControlBar>

      {/* Prediction Summary */}
      {showPredictions && (
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '8px',
          padding: '1.5rem',
          marginBottom: '2rem',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <h3 style={{ color: '#fff', marginBottom: '1rem' }}>🏁 Next Race Predictions</h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem'
          }}>
            {topPredictions.map(([team, stats], index) => (
              <div key={team} style={{
                padding: '1rem',
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                borderRadius: '6px',
                border: `2px solid ${getTeamColor(team)}`,
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: getTeamColor(team) }}>
                  #{index + 1} {team}
                </div>
                <div style={{ color: '#ccc', fontSize: '0.9rem' }}>
                  Score: {stats.predictiveScore.toFixed(1)}
                </div>
                <div style={{ color: '#ccc', fontSize: '0.8rem' }}>
                  Avg: {stats.averageTime.toFixed(2)}s
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Charts Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
        gap: '2rem',
        marginBottom: '2rem'
      }}>
        {/* Team Trend Chart */}
        {selectedTeam && (
          <div style={{
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '8px',
            padding: '1rem',
            height: '400px'
          }}>
            <Line data={teamTrendData} options={lineOptions} />
          </div>
        )}

        {/* Prediction Chart */}
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '8px',
          padding: '1rem',
          height: '400px'
        }}>
          <Bar data={predictionData} options={barOptions} />
        </div>

        {/* Consistency Chart */}
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '8px',
          padding: '1rem',
          height: '400px'
        }}>
          <Doughnut data={consistencyData} options={pieOptions} />
        </div>

        {/* Stats Table */}
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '8px',
          padding: '1rem',
          height: '400px',
          overflow: 'auto'
        }}>
          <h4 style={{ color: '#fff', marginBottom: '1rem' }}>Team Performance Stats</h4>
          <div style={{ fontSize: isMobile ? '0.8rem' : '0.9rem' }}>
            {Array.from(processedData.teamStats.entries())
              .sort((a, b) => a[1].averageTime - b[1].averageTime)
              .slice(0, 10)
              .map(([team, stats]) => (
                <div key={team} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '0.5rem',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#fff'
                }}>
                  <span style={{ color: getTeamColor(team), fontWeight: 'bold' }}>
                    {team}
                  </span>
                  <span>{stats.averageTime.toFixed(2)}s avg</span>
                </div>
              ))
            }
          </div>
        </div>
      </div>

      {/* Methodology */}
      <div style={{
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: '8px',
        padding: '1.5rem',
        marginTop: '2rem'
      }}>
        <h3 style={{ color: '#fff', marginBottom: '1rem' }}>📊 Prediction Methodology</h3>
        <p style={{ color: '#ccc', lineHeight: '1.6' }}>
          Our prediction algorithm considers: <strong>Consistency (30%)</strong> - frequency of top-10 appearances, 
          <strong>Speed (20%)</strong> - average pit stop times, <strong>Position (25%)</strong> - average ranking in top-10, 
          and <strong>Win Rate (25%)</strong> - percentage of fastest pit stops. Teams with higher scores are more likely 
          to achieve the fastest pit stop in upcoming races.
        </p>
      </div>
    </F1PageLayout>
  );
};

export default PitStopAnalysisPage;