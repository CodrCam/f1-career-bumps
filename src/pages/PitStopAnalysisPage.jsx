import React, { useState, useMemo, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Line, Bar, Scatter } from 'react-chartjs-2';
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
import { F1PageLayout } from '../components/ChartComponents.jsx';
import { ControlBar, ToggleSwitch } from '../components/UIControls.jsx';
import { getSeasonFromParam } from '../utils/seasons.js';
import {
  getDriverColor as getSharedDriverColor,
  getTeamColor,
  normalizeTeamName as normalizeTeamNameForSeason,
} from '../utils/dataProcessing.js';

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

// ===== DATA PROCESSING HELPERS =====

// Team and driver constants
const drivers2025 = [
  { id: "max_verstappen", driver: "Max Verstappen", team: "Red Bull" },
  { id: "yuki_tsunoda", driver: "Yuki Tsunoda", team: "Red Bull" },
  { id: "leclerc", driver: "Charles Leclerc", team: "Ferrari" },
  { id: "hamilton", driver: "Lewis Hamilton", team: "Ferrari" },
  { id: "norris", driver: "Lando Norris", team: "McLaren" },
  { id: "piastri", driver: "Oscar Piastri", team: "McLaren" },
  { id: "russell", driver: "George Russell", team: "Mercedes" },
  { id: "antonelli", driver: "Kimi Antonelli", team: "Mercedes" },
  { id: "alonso", driver: "Fernando Alonso", team: "Aston Martin" },
  { id: "stroll", driver: "Lance Stroll", team: "Aston Martin" },
  { id: "gasly", driver: "Pierre Gasly", team: "Alpine" },
  { id: "colapinto", driver: "Franco Colapinto", team: "Alpine" },
  { id: "doohan", driver: "Jack Doohan", team: "Alpine" },
  { id: "hadjar", driver: "Isack Hadjar", team: "Racing Bulls" },
  { id: "lawson", driver: "Liam Lawson", team: "Racing Bulls" },
  { id: "hulkenberg", driver: "Nico Hulkenberg", team: "Sauber" },
  { id: "bortoleto", driver: "Gabriel Bortoleto", team: "Sauber" },
  { id: "ocon", driver: "Esteban Ocon", team: "Haas" },
  { id: "bearman", driver: "Oliver Bearman", team: "Haas" },
  { id: "albon", driver: "Alexander Albon", team: "Williams" },
  { id: "sainz", driver: "Carlos Sainz", team: "Williams" },
];

const FORECAST_ONLY_TEAMS = [
  { name: 'Cadillac', firstSeason: 2026 },
];

const normalizePitTeamName = (teamName, seasonYear) => {
  const legacyName = teamName === 'Kick Sauber' ? 'Sauber' : teamName;
  return normalizeTeamNameForSeason(legacyName, seasonYear);
};

const getUnifiedTeamColor = (teamName) => {
  return getTeamColor(teamName);
};

const getDriverColor = (driverName, teamName) => {
  if (teamName) return getUnifiedTeamColor(teamName);

  const nameMapping = {
    'Alexander Albon': 'Alexander Albon',
    'Alex Albon': 'Alexander Albon',
    'Andrea Antonelli': 'Kimi Antonelli',
    'Kimi Antonelli': 'Kimi Antonelli'
  };
  
  const normalizedName = nameMapping[driverName] || driverName;
  const driver = drivers2025.find(d => d.driver === normalizedName);
  return driver
    ? getSharedDriverColor(driver.driver, driver.team, 2025)
    : '#FFFFFF';
};

const getEntityColor = (entity, analysisType, entityStats) => {
  if (analysisType === 'team') {
    return getUnifiedTeamColor(entity);
  } else {
    return getDriverColor(entity, entityStats?.team);
  }
};

// ===== MATHEMATICAL HELPERS =====

const calculateTrendSlope = (data) => {
  const n = data.length;
  if (n < 2) return 0;
  
  const sumX = data.reduce((sum, _, i) => sum + i, 0);
  const sumY = data.reduce((sum, y) => sum + y, 0);
  const sumXY = data.reduce((sum, y, i) => sum + i * y, 0);
  const sumX2 = data.reduce((sum, _, i) => sum + i * i, 0);
  
  return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
};

const calculateRecentFormScore = (recentForm) => {
  if (recentForm.length < 2) return 10;
  
  const recent = recentForm.slice(-3);
  const avgRecent = recent.reduce((sum, time) => sum + time, 0) / recent.length;
  const historical = recentForm.slice(0, -3);
  const avgHistorical = historical.length > 0 ? historical.reduce((sum, time) => sum + time, 0) / historical.length : avgRecent;
  
  const improvement = avgHistorical - avgRecent;
  return Math.max(0, Math.min(20, improvement * 10));
};

const calculateMedian = (values) => {
  const sortedValues = values
    .filter(Number.isFinite)
    .sort((a, b) => a - b);

  if (sortedValues.length === 0) return 0;

  const middleIndex = Math.floor(sortedValues.length / 2);
  if (sortedValues.length % 2 === 1) return sortedValues[middleIndex];

  return (sortedValues[middleIndex - 1] + sortedValues[middleIndex]) / 2;
};

const addForecastOnlyTeams = (teamStats, seasonYear) => {
  const historicalTeamStats = Array.from(teamStats.values());
  if (historicalTeamStats.length === 0) return;

  FORECAST_ONLY_TEAMS
    .filter(({ firstSeason }) => Number(seasonYear) >= firstSeason)
    .forEach(({ name, firstSeason }) => {
      if (teamStats.has(name)) return;

      teamStats.set(name, {
        rounds: [],
        totalStops: 0,
        allTimes: [],
        averageTimes: [],
        fastestStops: [],
        consistency: calculateMedian(historicalTeamStats.map((stats) => stats.consistency)),
        trend: 0,
        winRate: 0,
        recentForm: [],
        forecastScore: calculateMedian(historicalTeamStats.map((stats) => stats.forecastScore)),
        fastestRoundWins: 0,
        averageTime: calculateMedian(historicalTeamStats.map((stats) => stats.averageTime)),
        fastestTime: calculateMedian(historicalTeamStats.map((stats) => stats.fastestTime)),
        averageStopsPerRace: calculateMedian(
          historicalTeamStats.map((stats) => stats.averageStopsPerRace)
        ),
        isProjection: true,
        projectionLabel: `${firstSeason} field-median baseline`,
      });
    });
};

// ===== DATA PROCESSING FUNCTION =====

const processRaceData = (seasonYear) => {
  const teamStats = new Map();
  const driverStats = new Map();
  const roundData = [];
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
          roundInfo.fastestTeam = normalizePitTeamName(pitStop.team, seasonYear);
          roundInfo.fastestDriver = pitStop.driver;
        }
      });
    });

    roundData.push(roundInfo);

    // Process team and driver statistics
    round.pit_stops.forEach(pitStop => {
      const { driver, stops, average_time } = pitStop;
      const team = normalizePitTeamName(pitStop.team, seasonYear);
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
          recentForm: [],
          forecastScore: 0,
          fastestRoundWins: 0
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
          forecastScore: 0,
          fastestRoundWins: 0
        });
      }

      const teamStat = teamStats.get(team);
      const driverStat = driverStats.get(driver);

      // Process individual stops
      const stopTimes = stops.map(stop => stop.time);
      const fastestStopTime = Math.min(...stopTimes);
      
      // Update statistics
      [teamStat, driverStat].forEach(stat => {
        stat.rounds.push(round.round);
        stat.totalStops += stops.length;
        stat.allTimes.push(...stopTimes);
        stat.averageTimes.push(average_time);
        stat.fastestStops.push(fastestStopTime);
        stat.recentForm.push(average_time);

        if (fastestStopTime === fastestTime) {
          stat.fastestRoundWins++;
        }
      });
    });
  });

  // Calculate metrics for teams and drivers
  [teamStats, driverStats].forEach(statsMap => {
    statsMap.forEach((stats) => {
      const n = stats.averageTimes.length;
      if (n === 0) return;

      // Basic metrics
      stats.averageTime = stats.averageTimes.reduce((sum, time) => sum + time, 0) / n;
      stats.fastestTime = Math.min(...stats.fastestStops);
      stats.averageStopsPerRace = stats.totalStops / stats.rounds.length;
      
      // Consistency
      const variance = stats.averageTimes.reduce((sum, time) => sum + Math.pow(time - stats.averageTime, 2), 0) / n;
      stats.consistency = Math.sqrt(variance);
      
      // Trend analysis
      if (n >= 3) {
        const recentData = stats.recentForm.slice(-Math.min(5, n));
        stats.trend = calculateTrendSlope(recentData);
      }
      
      // Win rate
      const totalRounds = roundData.length;
      stats.winRate = (stats.fastestRoundWins / totalRounds) * 100;
      
      // Weighted forecast score
      const historicalWinScore = (stats.fastestRoundWins / totalRounds) * 40;
      const speedScore = Math.max(0, Math.min(25, (3.5 - stats.averageTime) * 12.5));
      const consistencyScore = Math.max(0, Math.min(20, (0.8 - stats.consistency) * 25));
      const trendScore = Math.max(0, Math.min(10, -stats.trend * 20));
      const recentFormScore = Math.min(5, calculateRecentFormScore(stats.recentForm) / 4);
      
      stats.forecastScore = historicalWinScore + speedScore + consistencyScore + trendScore + recentFormScore;
    });
  });

  addForecastOnlyTeams(teamStats, seasonYear);

  return {
    teamStats,
    driverStats,
    roundData,
    allTeams: Array.from(teamStats.keys()),
    allDrivers: Array.from(allDrivers)
  };
};

// ===== CHART DATA GENERATORS =====

const generateTrendData = (selectedEntity, analysisType, processedData) => {
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
};

const generateForecastData = (analysisType, processedData) => {
  const stats = analysisType === 'team' ? processedData.teamStats : processedData.driverStats;
  const sortedEntities = Array.from(stats.entries())
    .sort((a, b) => b[1].forecastScore - a[1].forecastScore)
    .slice(0, analysisType === 'team' ? stats.size : 10);

  return {
    labels: sortedEntities.map(([entity]) => entity),
    datasets: [{
      label: 'Forecast Score (0-100)',
      data: sortedEntities.map(([, stat]) => stat.forecastScore.toFixed(1)),
      backgroundColor: sortedEntities.map(([entity, stat]) => 
        getEntityColor(entity, analysisType, stat)
      ),
      borderColor: sortedEntities.map(([entity, stat]) => 
        getEntityColor(entity, analysisType, stat)
      ),
      borderWidth: 2
    }]
  };
};

const generateScatterData = (analysisType, processedData) => {
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
};

const generateStrategyData = (analysisType, processedData) => {
  const stats = analysisType === 'team' ? processedData.teamStats : processedData.driverStats;
  const entities = Array.from(stats.entries()).slice(0, 12);

  return {
    datasets: [{
      label: `${analysisType === 'team' ? 'Teams' : 'Drivers'} Strategy`,
      data: entities.map(([entity, stat]) => ({
        x: stat.averageTime,
        y: stat.averageStopsPerRace,
        label: entity,
        team: analysisType === 'team' ? entity : stat.team,
        forecastScore: stat.forecastScore,
        projectionLabel: stat.projectionLabel
      })),
      backgroundColor: entities.map(([entity, stat]) => 
        getEntityColor(entity, analysisType, stat)
      ),
      borderColor: entities.map(([entity, stat]) => 
        getEntityColor(entity, analysisType, stat)
      ),
      pointRadius: entities.map(([, stat]) => 8 + (stat.forecastScore / 100) * 4),
      pointHoverRadius: 12
    }]
  };
};

// ===== CHART OPTIONS =====

const getChartOptions = (type, selectedEntity, isMobile) => {
  const baseOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      tooltip: {
        callbacks: {}
      }
    }
  };

  switch (type) {
    case 'line':
      return {
        ...baseOptions,
        plugins: {
          ...baseOptions.plugins,
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

    case 'bar':
      return {
        ...baseOptions,
        plugins: {
          ...baseOptions.plugins,
          title: {
            display: true,
            text: `Weighted Trend Score - Next Race Forecast`,
            font: { size: isMobile ? 14 : 16 }
          },
          tooltip: {
            callbacks: {
              label: (context) => `Forecast Score: ${context.raw}/100`
            }
          }
        },
        scales: {
          y: {
            title: { display: true, text: 'Forecast Score (0-100)' },
            beginAtZero: true,
            max: 100
          }
        }
      };

    case 'scatter':
      return {
        ...baseOptions,
        plugins: {
          ...baseOptions.plugins,
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

    case 'strategy':
      return {
        ...baseOptions,
        plugins: {
          ...baseOptions.plugins,
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
                  `Forecast Score: ${point.forecastScore.toFixed(1)}/100`,
                  ...(point.projectionLabel ? [`Estimate: ${point.projectionLabel}`] : [])
                ];
              }
            }
          }
        },
        scales: {
          x: {
            title: { display: true, text: 'Average Pit Stop Time (seconds) - Faster →' },
            min: 2.0,
            max: 4.0
          },
          y: {
            title: { display: true, text: 'Average Pit Stops per Race' },
            min: 0.5,
            max: 3.0
          }
        }
      };

    default:
      return baseOptions;
  }
};

// ===== UI COMPONENTS =====

const ForecastSummary = ({ showForecast, analysisType, processedData, isMobile }) => {
  if (!showForecast) return null;

  const stats = analysisType === 'team' ? processedData.teamStats : processedData.driverStats;
  const topForecasts = Array.from(stats.entries())
    .sort((a, b) => b[1].forecastScore - a[1].forecastScore)
    .slice(0, 5);

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(168, 85, 247, 0.1))',
      borderRadius: '12px',
      padding: '2rem',
      marginBottom: '2rem',
      border: '1px solid rgba(99, 102, 241, 0.3)'
    }}>
      <h3 style={{ color: '#fff', marginBottom: '1rem', textAlign: 'center' }}>
        🏁 Pit Stop Trend Forecast ({analysisType === 'team' ? 'Teams' : 'Drivers'})
      </h3>
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '1rem'
      }}>
        {topForecasts.map(([entity, entityStats], index) => {
          const confidence = entityStats.forecastScore > 75 ? 'High' : 
                           entityStats.forecastScore > 50 ? 'Medium' : 'Low';
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
                Score: {entityStats.forecastScore.toFixed(1)}/100
              </div>
              <div style={{ color: '#ccc', fontSize: '0.8rem', marginBottom: '0.3rem' }}>
                Avg: {entityStats.averageTime.toFixed(2)}s | Fastest: {entityStats.fastestTime.toFixed(2)}s
              </div>
              <div style={{ color: '#ccc', fontSize: '0.8rem', marginBottom: '0.3rem' }}>
                Consistency: {entityStats.consistency.toFixed(3)}s
              </div>
              {entityStats.isProjection && (
                <div style={{ color: '#D9AD3A', fontSize: '0.75rem', marginBottom: '0.3rem' }}>
                  {entityStats.projectionLabel}
                </div>
              )}
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
  );
};

const PerformanceTable = ({ analysisType, processedData, isMobile }) => {
  const stats = analysisType === 'team' ? processedData.teamStats : processedData.driverStats;

  return (
    <div style={{
      backgroundColor: 'rgba(17, 20, 25, 0.98)',
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
                  {entityStats.isProjection && (
                    <span style={{
                      display: 'block',
                      color: '#a0a9c0',
                      fontSize: '0.65rem',
                      fontWeight: 'normal'
                    }}>
                      Projected baseline
                    </span>
                  )}
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
                  color: entityStats.forecastScore > 75 ? '#10B981' : 
                         entityStats.forecastScore > 50 ? '#F59E0B' : '#EF4444'
                }}>
                  {entityStats.forecastScore.toFixed(0)}
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
  );
};

// ===== MAIN COMPONENT =====

const PitStopAnalysisPage = () => {
  const { seasonYear } = useParams();
  const selectedYear = getSeasonFromParam(seasonYear);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [selectedEntity, setSelectedEntity] = useState('');
  const [showForecast, setShowForecast] = useState(true);
  const [analysisType, setAnalysisType] = useState('team');
  const [forecastModel, setForecastModel] = useState('weighted');

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const processedData = useMemo(() => processRaceData(selectedYear), [selectedYear]);

  // Generate chart data
  const trendData = useMemo(() => 
    generateTrendData(selectedEntity, analysisType, processedData), 
    [selectedEntity, analysisType, processedData]
  );

  const forecastData = useMemo(() => 
    generateForecastData(analysisType, processedData), 
    [analysisType, processedData]
  );

  const scatterData = useMemo(() => 
    generateScatterData(analysisType, processedData), 
    [analysisType, processedData]
  );

  const strategyData = useMemo(() => 
    generateStrategyData(analysisType, processedData), 
    [analysisType, processedData]
  );

  // Chart options
  const lineOptions = getChartOptions('line', selectedEntity, isMobile);
  const barOptions = getChartOptions('bar', selectedEntity, isMobile);
  const scatterOptions = getChartOptions('scatter', selectedEntity, isMobile);
  const strategyOptions = getChartOptions('strategy', selectedEntity, isMobile);

  const entityList = analysisType === 'team' ? processedData.allTeams : processedData.allDrivers;

  return (
    <F1PageLayout
      title={`${selectedYear} Pit Stop Trends & Forecasts`}
      subtitle="Weighted historical scoring for next-race pit stop performance"
      className="enhanced-pit-stop-analysis"
    >
      {/* Controls */}
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
          value={forecastModel}
          onChange={(e) => setForecastModel(e.target.value)}
          style={{
            padding: "0.75rem",
            fontSize: "1rem",
            borderRadius: "6px",
            border: "1px solid #555",
            backgroundColor: "#333",
            color: "#fff"
          }}
        >
          <option value="weighted">Weighted Trend Model</option>
          <option value="basic">Basic Statistical Model</option>
        </select>

        <ToggleSwitch
          checked={showForecast}
          onChange={(e) => setShowForecast(e.target.checked)}
          label="Show Forecast"
        />
      </ControlBar>

        {/* Forecast Summary */}
      <ForecastSummary 
        showForecast={showForecast}
        analysisType={analysisType}
        processedData={processedData}
        isMobile={isMobile}
      />

      {/* Analytics Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
        gap: '2rem',
        marginBottom: '2rem'
      }}>
        {/* Trend Analysis Chart */}
        {selectedEntity ? (
          <div style={{
            backgroundColor: 'rgba(17, 20, 25, 0.98)',
            borderRadius: '8px',
            padding: '1rem',
            height: '400px'
          }}>
            <Line data={trendData} options={lineOptions} />
          </div>
        ) : (
          /* Strategy Analysis when no entity selected */
          <div style={{
            backgroundColor: 'rgba(17, 20, 25, 0.98)',
            borderRadius: '8px',
            padding: '1rem',
            height: '400px'
          }}>
            <Scatter data={strategyData} options={strategyOptions} />
          </div>
        )}

        {/* Statistical Forecast Chart */}
        <div style={{
          backgroundColor: 'rgba(17, 20, 25, 0.98)',
          borderRadius: '8px',
          padding: '1rem',
          height: '400px'
        }}>
          <Bar data={forecastData} options={barOptions} />
        </div>

        {/* Performance vs Consistency Scatter */}
        <div style={{
          backgroundColor: 'rgba(17, 20, 25, 0.98)',
          borderRadius: '8px',
          padding: '1rem',
          height: '400px'
        }}>
          <Scatter data={scatterData} options={scatterOptions} />
        </div>

        {/* Performance Statistics Table */}
        <PerformanceTable 
          analysisType={analysisType}
          processedData={processedData}
          isMobile={isMobile}
        />
      </div>
    </F1PageLayout>
  );
};

export default PitStopAnalysisPage;
