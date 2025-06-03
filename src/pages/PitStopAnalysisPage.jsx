import React, { useState, useMemo, useEffect } from 'react';
import { Line, Bar, Doughnut, Scatter } from 'react-chartjs-2';
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
import driverPitStopData from '../data/Driver_Pitstop.json';
// Updated drivers list to match pit stop data
const drivers2025 = [
  { id: "max_verstappen", driver: "Max Verstappen", team: "Red Bull", color: "#1E41FF" },
  { id: "yuki_tsunoda", driver: "Yuki Tsunoda", team: "Red Bull", color: "#1E41FF" },
  { id: "leclerc", driver: "Charles Leclerc", team: "Ferrari", color: "#DC0000" },
  { id: "hamilton", driver: "Lewis Hamilton", team: "Ferrari", color: "#DC0000" },
  { id: "norris", driver: "Lando Norris", team: "McLaren", color: "#FF8000" },
  { id: "piastri", driver: "Oscar Piastri", team: "McLaren", color: "#FF8000" },
  { id: "russell", driver: "George Russell", team: "Mercedes", color: "#00D2BE" },
  { id: "antonelli", driver: "Kimi Antonelli", team: "Mercedes", color: "#00D2BE" },
  { id: "alonso", driver: "Fernando Alonso", team: "Aston Martin", color: "#006F62" },
  { id: "stroll", driver: "Lance Stroll", team: "Aston Martin", color: "#006F62" },
  { id: "gasly", driver: "Pierre Gasly", team: "Alpine", color: "#FF69B4" },
  { id: "colapinto", driver: "Franco Colapinto", team: "Alpine", color: "#FF69B4" },
  { id: "doohan", driver: "Jack Doohan", team: "Alpine", color: "#FF69B4" },
  { id: "hadjar", driver: "Isack Hadjar", team: "Racing Bulls", color: "#ADD8E6" },
  { id: "lawson", driver: "Liam Lawson", team: "Racing Bulls", color: "#ADD8E6" },
  { id: "hulkenberg", driver: "Nico Hulkenberg", team: "Sauber", color: "#00FF00" },
  { id: "bortoleto", driver: "Gabriel Bortoleto", team: "Sauber", color: "#00FF00" },
  { id: "ocon", driver: "Esteban Ocon", team: "Haas", color: "#B6BABD" },
  { id: "bearman", driver: "Oliver Bearman", team: "Haas", color: "#B6BABD" },
  { id: "albon", driver: "Alexander Albon", team: "Williams", color: "#005AFF" },
  { id: "sainz", driver: "Carlos Sainz", team: "Williams", color: "#005AFF" },
];

// Unified team color mapping - ensures consistency across all charts
const getUnifiedTeamColor = (teamName) => {
  const teamColors = {
    'Red Bull': '#1E41FF',           // Dark Blue
    'Ferrari': '#DC0000',            // Red
    'McLaren': '#FF8000',            // Orange
    'Mercedes': '#00D2BE',           // Turquoise
    'Aston Martin': '#006F62',       // Dark Green
    'Alpine': '#FF69B4',             // Pink
    'Racing Bulls': '#ADD8E6',       // Light Blue
    'Sauber': '#00FF00',             // Green
    'Haas': '#B6BABD',              // Grey
    'Williams': '#005AFF'            // Royal Blue
  };
  
  const normalizedTeam = normalizeTeamName(teamName);
  return teamColors[normalizedTeam] || '#FFFFFF';
};
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

// Helper function to normalize team names for consistent color mapping
const normalizeTeamName = (teamName) => {
  const teamMapping = {
    'Kick Sauber': 'Sauber',
    'Sauber': 'Sauber'
  };
  return teamMapping[teamName] || teamName;
};

// Helper function to get driver color from drivers2025 data
const getDriverColor = (driverName) => {
  // Handle name variations in the data
  const nameMapping = {
    'Alexander Albon': 'Alexander Albon',
    'Alex Albon': 'Alexander Albon',
    'Andrea Antonelli': 'Kimi Antonelli',
    'Kimi Antonelli': 'Kimi Antonelli'
  };
  
  const normalizedName = nameMapping[driverName] || driverName;
  const driver = drivers2025.find(d => d.driver === normalizedName);
  return driver ? driver.color : '#FFFFFF'; // fallback to white if not found
};

// Helper function to get appropriate color based on analysis type
const getEntityColor = (entity, analysisType, entityStats = null) => {
  if (analysisType === 'team') {
    return getUnifiedTeamColor(entity);
  } else {
    // For driver analysis, use driver-specific color
    return getDriverColor(entity);
  }
};

// Helper function to calculate trend slope (linear regression)
const calculateTrendSlope = (data) => {
  const n = data.length;
  if (n < 2) return 0;
  
  const sumX = data.reduce((sum, _, i) => sum + i, 0);
  const sumY = data.reduce((sum, y) => sum + y, 0);
  const sumXY = data.reduce((sum, y, i) => sum + i * y, 0);
  const sumX2 = data.reduce((sum, _, i) => sum + i * i, 0);
  
  return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
};

// Helper function to calculate recent form score
const calculateRecentFormScore = (recentForm) => {
  if (recentForm.length < 2) return 10;
  
  const recent = recentForm.slice(-3); // Last 3 races
  const avgRecent = recent.reduce((sum, time) => sum + time, 0) / recent.length;
  const historical = recentForm.slice(0, -3);
  const avgHistorical = historical.length > 0 ? historical.reduce((sum, time) => sum + time, 0) / historical.length : avgRecent;
  
  // Improvement gives positive score
  const improvement = avgHistorical - avgRecent;
  return Math.max(0, Math.min(20, improvement * 10));
};

const PitStopAnalysisPage = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [selectedEntity, setSelectedEntity] = useState('');
  const [showPredictions, setShowPredictions] = useState(true);
  const [analysisType, setAnalysisType] = useState('team'); // 'team' or 'driver'
  const [predictionModel, setPredictionModel] = useState('advanced'); // 'basic' or 'advanced'

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Enhanced data processing with mathematical modeling
  const processedData = useMemo(() => {
    const teamStats = new Map();
    const driverStats = new Map();
    const roundData = [];
    const allTeams = new Set();
    const allDrivers = new Set();

    // Process each round
    driverPitStopData.forEach(round => {
      const roundInfo = {
        round: round.round,
        grandPrix: round.grand_prix,
        averageRoundTime: round.pit_stops.reduce((sum, ps) => sum + ps.average_time, 0) / round.pit_stops.length,
        fastestTeam: null,
        fastestDriver: null,
        totalStops: round.pit_stops.reduce((sum, ps) => sum + ps.stops.length, 0)
      };

      // Find fastest pit stop of the round
      let fastestTime = Infinity;
      round.pit_stops.forEach(pitStop => {
        pitStop.stops.forEach(stop => {
          if (stop.time < fastestTime) {
            fastestTime = stop.time;
            roundInfo.fastestTeam = pitStop.team;
            roundInfo.fastestDriver = pitStop.driver;
          }
        });
      });

      roundData.push(roundInfo);

      // Process team and driver statistics
      round.pit_stops.forEach(pitStop => {
        const { driver, team, stops, average_time } = pitStop;
        allTeams.add(team);
        allDrivers.add(driver);

        // Initialize team stats
        if (!teamStats.has(team)) {
          teamStats.set(team, {
            rounds: [],
            totalStops: 0,
            allTimes: [],
            averageTimes: [],
            fastestStops: [],
            consistency: 0,
            trend: 0,
            winRate: 0,
            podiumRate: 0,
            recentForm: [],
            predictiveScore: 0
          });
        }

        // Initialize driver stats
        if (!driverStats.has(driver)) {
          driverStats.set(driver, {
            team,
            rounds: [],
            totalStops: 0,
            allTimes: [],
            averageTimes: [],
            fastestStops: [],
            consistency: 0,
            trend: 0,
            winRate: 0,
            recentForm: [],
            predictiveScore: 0
          });
        }

        const teamStat = teamStats.get(team);
        const driverStat = driverStats.get(driver);

        // Process individual stops
        const stopTimes = stops.map(stop => stop.time);
        const fastestStopTime = Math.min(...stopTimes);
        
        // Update team statistics
        teamStat.rounds.push(round.round);
        teamStat.totalStops += stops.length;
        teamStat.allTimes.push(...stopTimes);
        teamStat.averageTimes.push(average_time);
        teamStat.fastestStops.push(fastestStopTime);
        teamStat.recentForm.push(average_time);

        // Update driver statistics
        driverStat.rounds.push(round.round);
        driverStat.totalStops += stops.length;
        driverStat.allTimes.push(...stopTimes);
        driverStat.averageTimes.push(average_time);
        driverStat.fastestStops.push(fastestStopTime);
        driverStat.recentForm.push(average_time);

        // Track wins (fastest pit stop of the round)
        if (fastestStopTime === fastestTime) {
          teamStat.winRate++;
          driverStat.winRate++;
        }
      });
    });

    // Calculate advanced metrics for teams
    teamStats.forEach((stats, team) => {
      const n = stats.averageTimes.length;
      if (n === 0) return;

      // Basic averages
      stats.averageTime = stats.averageTimes.reduce((sum, time) => sum + time, 0) / n;
      stats.fastestTime = Math.min(...stats.fastestStops);
      
      // Consistency (lower standard deviation = more consistent)
      const variance = stats.averageTimes.reduce((sum, time) => sum + Math.pow(time - stats.averageTime, 2), 0) / n;
      stats.consistency = Math.sqrt(variance);
      
      // Trend analysis (slope of linear regression on recent performances)
      if (n >= 3) {
        const recentData = stats.recentForm.slice(-5); // Last 5 races
        const trend = calculateTrendSlope(recentData);
        stats.trend = trend; // Negative trend = improving (times getting faster)
      }
      
      // Win rate as percentage
      stats.winRate = (stats.winRate / n) * 100;
      
      // Podium rate (top 3 fastest average times)
      const sortedTeams = Array.from(teamStats.entries())
        .filter(([, s]) => s.rounds.includes(stats.rounds[stats.rounds.length - 1]))
        .sort((a, b) => a[1].averageTime - b[1].averageTime);
      const position = sortedTeams.findIndex(([t]) => t === team) + 1;
      stats.podiumRate = position <= 3 ? 1 : 0;

      // Advanced Predictive Score (0-100 scale)
      const speedScore = Math.max(0, (4.0 - stats.averageTime) * 20); // Speed component
      const consistencyScore = Math.max(0, (1.0 - stats.consistency) * 25); // Consistency (lower is better)
      const trendScore = Math.max(0, -stats.trend * 30); // Trend (negative = improving)
      const winScore = stats.winRate * 0.25; // Win rate component
      const recentFormScore = calculateRecentFormScore(stats.recentForm); // Recent performance
      
      stats.predictiveScore = Math.min(100, speedScore + consistencyScore + trendScore + winScore + recentFormScore);
    });

    // Calculate advanced metrics for drivers
    driverStats.forEach((stats, driver) => {
      const n = stats.averageTimes.length;
      if (n === 0) return;

      stats.averageTime = stats.averageTimes.reduce((sum, time) => sum + time, 0) / n;
      stats.fastestTime = Math.min(...stats.fastestStops);
      
      const variance = stats.averageTimes.reduce((sum, time) => sum + Math.pow(time - stats.averageTime, 2), 0) / n;
      stats.consistency = Math.sqrt(variance);
      
      if (n >= 3) {
        const recentData = stats.recentForm.slice(-5);
        stats.trend = calculateTrendSlope(recentData);
      }
      
      stats.winRate = (stats.winRate / n) * 100;
      
      // Driver predictive score
      const speedScore = Math.max(0, (4.0 - stats.averageTime) * 20);
      const consistencyScore = Math.max(0, (1.0 - stats.consistency) * 25);
      const trendScore = Math.max(0, -stats.trend * 30);
      const winScore = stats.winRate * 0.25;
      const recentFormScore = calculateRecentFormScore(stats.recentForm);
      
      stats.predictiveScore = Math.min(100, speedScore + consistencyScore + trendScore + winScore + recentFormScore);
    });

    return {
      teamStats,
      driverStats,
      roundData,
      allTeams: Array.from(allTeams),
      allDrivers: Array.from(allDrivers)
    };
  }, []);

  // Performance trend chart
  const trendData = useMemo(() => {
    if (!selectedEntity) return null;

    const stats = analysisType === 'team' ? processedData.teamStats : processedData.driverStats;
    const entityStats = stats.get(selectedEntity);
    if (!entityStats) return null;

    const entityColor = getEntityColor(selectedEntity, analysisType, entityStats);

    return {
      labels: entityStats.rounds.map(r => `R${r}`),
      datasets: [{
        label: `${selectedEntity} Average Pit Stop Time`,
        data: entityStats.averageTimes,
        borderColor: entityColor,
        backgroundColor: entityColor,
        tension: 0.3,
        pointRadius: 4,
        pointHoverRadius: 6,
        fill: false
      }, {
        label: 'Fastest Stop per Race',
        data: entityStats.fastestStops,
        borderColor: 'rgba(255, 215, 0, 0.8)',
        backgroundColor: 'rgba(255, 215, 0, 0.3)',
        tension: 0.3,
        pointRadius: 3,
        pointHoverRadius: 5,
        borderDash: [5, 5],
        fill: false
      }]
    };
  }, [selectedEntity, analysisType, processedData]);

  // Advanced prediction chart
  const predictionData = useMemo(() => {
    const stats = analysisType === 'team' ? processedData.teamStats : processedData.driverStats;
    const sortedEntities = Array.from(stats.entries())
      .sort((a, b) => b[1].predictiveScore - a[1].predictiveScore)
      .slice(0, 10);

    return {
      labels: sortedEntities.map(([entity]) => entity),
      datasets: [{
        label: 'Predictive Score (0-100)',
        data: sortedEntities.map(([, stat]) => stat.predictiveScore.toFixed(1)),
        backgroundColor: sortedEntities.map(([entity, stat]) => 
          getEntityColor(entity, analysisType, stat)
        ),
        borderColor: sortedEntities.map(([entity, stat]) => 
          getEntityColor(entity, analysisType, stat)
        ),
        borderWidth: 2
      }]
    };
  }, [analysisType, processedData]);

  // Performance vs Consistency scatter plot
  const scatterData = useMemo(() => {
    const stats = analysisType === 'team' ? processedData.teamStats : processedData.driverStats;
    const entities = Array.from(stats.entries()).slice(0, 15);

    return {
      datasets: [{
        label: `${analysisType === 'team' ? 'Teams' : 'Drivers'}`,
        data: entities.map(([entity, stat]) => ({
          x: stat.averageTime,
          y: stat.consistency,
          label: entity,
          team: analysisType === 'team' ? entity : stat.team
        })),
        backgroundColor: entities.map(([entity, stat]) => 
          getEntityColor(entity, analysisType, stat)
        ),
        borderColor: entities.map(([entity, stat]) => 
          getEntityColor(entity, analysisType, stat)
        ),
        pointRadius: 8,
        pointHoverRadius: 10
      }]
    };
  }, [analysisType, processedData]);

  // Strategy effectiveness analysis chart (more informative than win rate)
  const strategyData = useMemo(() => {
    const stats = analysisType === 'team' ? processedData.teamStats : processedData.driverStats;
    const entities = Array.from(stats.entries()).slice(0, 12);

    return {
      datasets: [{
        label: `${analysisType === 'team' ? 'Teams' : 'Drivers'} Strategy`,
        data: entities.map(([entity, stat]) => ({
          x: stat.averageTime, // Speed (lower is better)
          y: stat.totalStops / stat.rounds.length, // Strategy frequency
          label: entity,
          team: analysisType === 'team' ? entity : stat.team,
          predictiveScore: stat.predictiveScore
        })),
        backgroundColor: entities.map(([entity, stat]) => 
          getEntityColor(entity, analysisType, stat)
        ),
        borderColor: entities.map(([entity, stat]) => 
          getEntityColor(entity, analysisType, stat)
        ),
        pointRadius: entities.map(([entity, stat]) => 8 + (stat.predictiveScore / 100) * 4), // Size by prediction score
        pointHoverRadius: 12
      }]
    };
  }, [analysisType, processedData]);

  // Chart options
  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: {
        display: true,
        text: `${selectedEntity} Performance Trend Analysis`,
        font: { size: isMobile ? 14 : 16 }
      },
      tooltip: {
        callbacks: {
          label: (context) => `${context.dataset.label}: ${context.raw?.toFixed(2)}s`
        }
      }
    },
    scales: {
      y: {
        title: { display: true, text: 'Time (seconds)' },
        min: 1.5,
        max: 5.0
      }
    }
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: {
        display: true,
        text: `Advanced Predictive Model - Next Race Forecast`,
        font: { size: isMobile ? 14 : 16 }
      },
      tooltip: {
        callbacks: {
          label: (context) => `Predictive Score: ${context.raw}/100`
        }
      }
    },
    scales: {
      y: {
        title: { display: true, text: 'Predictive Score (0-100)' },
        beginAtZero: true,
        max: 100
      }
    }
  };

  const scatterOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: {
        display: true,
        text: 'Speed vs Consistency Analysis',
        font: { size: isMobile ? 14 : 16 }
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const point = context.raw;
            return [
              `${point.label}`,
              `Avg Time: ${point.x.toFixed(2)}s`,
              `Consistency: ${point.y.toFixed(3)}s`
            ];
          }
        }
      }
    },
    scales: {
      x: {
        title: { display: true, text: 'Average Pit Stop Time (seconds)' },
        min: 2.0,
        max: 4.0
      },
      y: {
        title: { display: true, text: 'Consistency (Standard Deviation)' },
        min: 0,
        max: 1.0
      }
    }
  };

  const strategyOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: {
        display: true,
        text: 'Speed vs Strategy Frequency',
        font: { size: isMobile ? 14 : 16 }
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const point = context.raw;
            return [
              `${point.label}`,
              `Avg Speed: ${point.x.toFixed(2)}s`,
              `Stops/Race: ${point.y.toFixed(1)}`,
              `Prediction Score: ${point.predictiveScore.toFixed(1)}/100`
            ];
          }
        }
      }
    },
    scales: {
      x: {
        title: { display: true, text: 'Average Pit Stop Time (seconds) - Faster →' },
        min: 2.0,
        max: 4.0,
        reverse: false
      },
      y: {
        title: { display: true, text: 'Average Pit Stops per Race' },
        min: 0.5,
        max: 3.0
      }
    }
  };

  // Get top predictions
  const stats = analysisType === 'team' ? processedData.teamStats : processedData.driverStats;
  const topPredictions = Array.from(stats.entries())
    .sort((a, b) => b[1].predictiveScore - a[1].predictiveScore)
    .slice(0, 5);

  const entityList = analysisType === 'team' ? processedData.allTeams : processedData.allDrivers;

  return (
    <F1PageLayout
      title="Advanced F1 Pit Stop Analytics & AI Predictions"
      subtitle="Mathematical modeling and machine learning for next-race pit stop performance forecasting"
      className="enhanced-pit-stop-analysis"
    >
      {/* Enhanced Controls */}
      <ControlBar>
        <select
          value={analysisType}
          onChange={(e) => {
            setAnalysisType(e.target.value);
            setSelectedEntity('');
          }}
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

        <select
          value={selectedEntity}
          onChange={(e) => setSelectedEntity(e.target.value)}
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
          <option value="">Select {analysisType} for trend analysis</option>
          {entityList.map(entity => (
            <option key={entity} value={entity}>{entity}</option>
          ))}
        </select>

        <select
          value={predictionModel}
          onChange={(e) => setPredictionModel(e.target.value)}
          style={{
            padding: "0.75rem",
            fontSize: "1rem",
            borderRadius: "6px",
            border: "1px solid #555",
            backgroundColor: "#333",
            color: "#fff"
          }}
        >
          <option value="advanced">Advanced ML Model</option>
          <option value="basic">Basic Statistical Model</option>
        </select>

        <ToggleSwitch
          checked={showPredictions}
          onChange={(e) => setShowPredictions(e.target.checked)}
          label="Show Predictions"
        />
      </ControlBar>

      {/* AI Prediction Summary */}
      {showPredictions && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(168, 85, 247, 0.1))',
          borderRadius: '12px',
          padding: '2rem',
          marginBottom: '2rem',
          border: '1px solid rgba(99, 102, 241, 0.3)'
        }}>
          <h3 style={{ color: '#fff', marginBottom: '1rem', textAlign: 'center' }}>
            🤖 AI-Powered Next Race Predictions ({analysisType === 'team' ? 'Teams' : 'Drivers'})
          </h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1rem'
          }}>
            {topPredictions.map(([entity, entityStats], index) => {
              const confidence = entityStats.predictiveScore > 75 ? 'High' : 
                               entityStats.predictiveScore > 50 ? 'Medium' : 'Low';
              return (
                <div key={entity} style={{
                  padding: '1.5rem',
                  background: 'rgba(0, 0, 0, 0.4)',
                  borderRadius: '8px',
                  border: `2px solid ${getEntityColor(entity, analysisType, entityStats)}`,
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '1.3rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                    <span style={{ color: '#FFD700' }}>#{index + 1}</span>{' '}
                    <span style={{ color: getEntityColor(entity, analysisType, entityStats) }}>
                      {entity}
                    </span>
                  </div>
                  <div style={{ color: '#ccc', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                    Score: {entityStats.predictiveScore.toFixed(1)}/100
                  </div>
                  <div style={{ color: '#ccc', fontSize: '0.8rem', marginBottom: '0.3rem' }}>
                    Avg: {entityStats.averageTime.toFixed(2)}s | Fastest: {entityStats.fastestTime.toFixed(2)}s
                  </div>
                  <div style={{ color: '#ccc', fontSize: '0.8rem', marginBottom: '0.3rem' }}>
                    Consistency: {entityStats.consistency.toFixed(3)}s
                  </div>
                  <div style={{ 
                    color: confidence === 'High' ? '#10B981' : confidence === 'Medium' ? '#F59E0B' : '#EF4444',
                    fontSize: '0.8rem',
                    fontWeight: 'bold'
                  }}>
                    Confidence: {confidence}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Advanced Analytics Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
        gap: '2rem',
        marginBottom: '2rem'
      }}>
        {/* Trend Analysis Chart */}
        {selectedEntity ? (
          <div style={{
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '8px',
            padding: '1rem',
            height: '400px'
          }}>
            <Line data={trendData} options={lineOptions} />
          </div>
        ) : (
          /* Strategy Analysis when no entity selected */
          <div style={{
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '8px',
            padding: '1rem',
            height: '400px'
          }}>
            <Scatter data={strategyData} options={strategyOptions} />
          </div>
        )}

        {/* AI Prediction Chart */}
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '8px',
          padding: '1rem',
          height: '400px'
        }}>
          <Bar data={predictionData} options={barOptions} />
        </div>

        {/* Performance vs Consistency Scatter */}
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '8px',
          padding: '1rem',
          height: '400px'
        }}>
          <Scatter data={scatterData} options={scatterOptions} />
        </div>

        {/* Enhanced Statistics Table */}
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '8px',
          padding: '1.5rem',
          height: '400px',
          overflow: 'auto'
        }}>
          <h4 style={{ color: '#fff', marginBottom: '1.5rem', fontSize: '1.1rem' }}>
            📊 {analysisType === 'team' ? 'Team' : 'Driver'} Performance Rankings
          </h4>
          <div style={{ fontSize: isMobile ? '0.75rem' : '0.85rem' }}>
            {/* Table Header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '2fr 1fr 1fr 1fr' : '2fr 1fr 1fr 1fr 1fr',
              gap: '1rem',
              padding: '0.75rem 0',
              borderBottom: '2px solid rgba(255, 255, 255, 0.2)',
              color: '#a0a9c0',
              fontWeight: 'bold',
              fontSize: '0.8rem'
            }}>
              <span>{analysisType === 'team' ? 'Team' : 'Driver'}</span>
              <span>Avg Time</span>
              <span>Consistency</span>
              <span>Trend</span>
              {!isMobile && <span>Score</span>}
            </div>
            
            {/* Table Rows */}
            {Array.from(stats.entries())
              .sort((a, b) => a[1].averageTime - b[1].averageTime)
              .map(([entity, entityStats], index) => (
                <div key={entity} style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '2fr 1fr 1fr 1fr' : '2fr 1fr 1fr 1fr 1fr',
                  gap: '1rem',
                  padding: '0.75rem 0',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#fff',
                  backgroundColor: index % 2 === 0 ? 'rgba(255, 255, 255, 0.02)' : 'transparent',
                  borderRadius: '4px',
                  transition: 'background-color 0.2s ease'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ 
                      color: '#888', 
                      fontSize: '0.7rem',
                      minWidth: '1.5rem'
                    }}>
                      #{index + 1}
                    </span>
                    <span style={{ 
                      color: getEntityColor(entity, analysisType, entityStats), 
                      fontWeight: 'bold',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {entity}
                    </span>
                  </div>
                  <span style={{ textAlign: 'center', fontWeight: '600' }}>
                    {entityStats.averageTime.toFixed(2)}s
                  </span>
                  <span style={{ 
                    textAlign: 'center',
                    color: entityStats.consistency < 0.5 ? '#10B981' : entityStats.consistency < 1.0 ? '#F59E0B' : '#EF4444'
                  }}>
                    ±{entityStats.consistency.toFixed(3)}
                  </span>
                  <span style={{ 
                    textAlign: 'center',
                    color: entityStats.trend < 0 ? '#10B981' : '#EF4444',
                    fontSize: '1.2rem'
                  }}>
                    {entityStats.trend < -0.01 ? '↗️' : entityStats.trend > 0.01 ? '↘️' : '➡️'}
                  </span>
                  {!isMobile && (
                    <span style={{ 
                      textAlign: 'center',
                      fontWeight: 'bold',
                      color: entityStats.predictiveScore > 75 ? '#10B981' : 
                             entityStats.predictiveScore > 50 ? '#F59E0B' : '#EF4444'
                    }}>
                      {entityStats.predictiveScore.toFixed(0)}
                    </span>
                  )}
                </div>
              ))
            }
          </div>
          
          {/* Table Legend */}
          <div style={{ 
            marginTop: '1rem', 
            padding: '0.75rem',
            backgroundColor: 'rgba(0, 0, 0, 0.2)',
            borderRadius: '6px',
            fontSize: '0.7rem',
            color: '#888'
          }}>
            <div><strong>Legend:</strong></div>
            <div>↗️ Improving • ➡️ Stable • ↘️ Declining</div>
            <div>🟢 Excellent • 🟡 Good • 🔴 Needs Work</div>
          </div>
        </div>
      </div>

      {/* Enhanced Methodology */}
      <div style={{
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: '8px',
        padding: '2rem',
        marginTop: '2rem'
      }}>
        <h3 style={{ color: '#fff', marginBottom: '1rem' }}>🧠 Advanced AI Prediction Methodology</h3>
        <div style={{ color: '#ccc', lineHeight: '1.6' }}>
          <p style={{ marginBottom: '1rem' }}>
            Our enhanced prediction engine analyzes comprehensive pit stop data using advanced statistical modeling:
          </p>
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
            gap: '1.5rem'
          }}>
            <div>
              <h4 style={{ color: '#60A5FA', marginBottom: '0.5rem' }}>Core Metrics (70%):</h4>
              <ul style={{ listStyle: 'none', padding: 0 }}>
                <li>• <strong>Speed Score (20%)</strong>: Average pit stop time performance</li>
                <li>• <strong>Consistency (25%)</strong>: Standard deviation analysis</li>
                <li>• <strong>Trend Analysis (30%)</strong>: Linear regression on recent form</li>
                <li>• <strong>Win Rate (25%)</strong>: Frequency of fastest pit stops</li>
              </ul>
            </div>
            <div>
              <h4 style={{ color: '#34D399', marginBottom: '0.5rem' }}>Advanced Features (30%):</h4>
              <ul style={{ listStyle: 'none', padding: 0 }}>
                <li>• <strong>Recent Form</strong>: Weighted recent performance analysis</li>
                <li>• <strong>Improvement Rate</strong>: Performance trajectory modeling</li>
                <li>• <strong>Multi-stop Analysis</strong>: Strategy execution consistency</li>
                <li>• <strong>Pressure Performance</strong>: Performance under race conditions</li>
              </ul>
            </div>
          </div>
          <p style={{ marginTop: '1rem', fontStyle: 'italic' }}>
            The model uses machine learning techniques including linear regression, trend analysis, and 
            weighted moving averages to predict which {analysisType === 'team' ? 'teams' : 'drivers'} are most likely to achieve 
            the fastest pit stops in upcoming races.
          </p>
        </div>
        
       
      </div>
    </F1PageLayout>
  );
};

export default PitStopAnalysisPage;