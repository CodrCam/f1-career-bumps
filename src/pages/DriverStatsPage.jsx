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
import { Bar, Scatter, Radar, Line } from "react-chartjs-2";
import { useSeasonData } from "../hooks/useSeasonData.js";
import { getSeasonFromParam } from "../utils/seasons.js";
import { parseDriverStats } from "../utils/parseDriverStats";
import { useProcessedRaceData } from "../utils/dataProcessing.js";
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

// Enhanced team color mapping with consistent colors
const getTeamColor = (teamName) => {
  const teamColors = {
    'McLaren': '#FF8000',
    'Mercedes': '#00D2BE', 
    'Red Bull Racing': '#1E41FF',
    'Ferrari': '#DC0000',
    'Williams': '#005AFF',
    'Alpine': '#FF69B4',
    'Aston Martin': '#006F62',
    'Haas': '#B6BABD',
    'Racing Bulls': '#ADD8E6',
    'Audi': '#00E676',
    'Kick Sauber': '#00FF00',
    'Sauber': '#00FF00'
  };
  return teamColors[teamName] || '#FFFFFF';
};

// Enhanced driver color system with teammate variations
const getDriverColor = (driverName, teamName) => {
  if (teamName === 'Audi') return getTeamColor(teamName);

  const driverVariations = {
    // Red Bull
    'Max Verstappen': '#1E41FF',
    'Yuki Tsunoda': '#0F2080',
    // Ferrari  
    'Charles Leclerc': '#DC0000',
    'Lewis Hamilton': '#B30000',
    // McLaren
    'Lando Norris': '#FF8000',
    'Oscar Piastri': '#CC6600',
    // Mercedes
    'George Russell': '#00D2BE',
    'Kimi Antonelli': '#00B5A0',
    // Aston Martin
    'Fernando Alonso': '#006F62',
    'Lance Stroll': '#004F45',
    // Alpine
    'Pierre Gasly': '#FF69B4',
    'Franco Colapinto': '#CC4A8C',
    'Jack Doohan': '#AA3F75',
    // Williams
    'Alexander Albon': '#005AFF',
    'Carlos Sainz': '#0040CC',
    // Haas
    'Esteban Ocon': '#B6BABD',
    'Oliver Bearman': '#999C9F',
    // Racing Bulls
    'Isack Hadjar': '#ADD8E6',
    'Liam Lawson': '#8BC5E6',
    // Sauber
    'Nico Hulkenberg': '#00FF00',
    'Gabriel Bortoleto': '#00CC00'
  };
  
  return driverVariations[driverName] || getTeamColor(teamName);
};

const DriverStatsPage = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [showRadarChart, setShowRadarChart] = useState(false);
  const [sortBy, setSortBy] = useState('points');
  const [analysisType, setAnalysisType] = useState('performance');
  const [showTopDriversOnly, setShowTopDriversOnly] = useState(false);
  const { seasonYear } = useParams();
  const selectedYear = getSeasonFromParam(seasonYear);
  const { races } = useSeasonData(selectedYear);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Use shared processing utility
  const processedRaces = useProcessedRaceData(races);
  
  // Calculate recent performance trend
  const calculateRecentPerformance = (driverName, races, recentCount) => {
    const driverRaces = races.slice(-recentCount);
    let totalPoints = 0;
    let raceCount = 0;
    
    driverRaces.forEach(race => {
      const result = race.race_results.find(r => r.driver === driverName);
      if (result) {
        totalPoints += result.points || 0;
        raceCount++;
      }
    });
    
    return raceCount > 0 ? (totalPoints / raceCount).toFixed(1) : '0.0';
  };
  
  // Enhanced data processing
  const { teamStats, allDrivers, driverPerformanceData, topPerformers } = useMemo(() => {
    if (processedRaces.length === 0) return { 
      teamStats: {}, 
      allDrivers: [], 
      driverPerformanceData: [],
      topPerformers: []
    };

    const parsed = parseDriverStats({ races: processedRaces });
    const grouped = {};
    const allDriversList = [];
    
    // Enhanced driver metrics calculation
    const enhancedDrivers = parsed.map(driver => {
      const races = processedRaces.length;
      const pointsPerRace = driver.points / races;
      
      // Advanced consistency calculation
      const consistency = Math.max(0, 1 - (
        (driver.normFinish * 0.4) + 
        (driver.normQuali * 0.3) + 
        ((1 - driver.normHead) * 0.3)
      ));
      
      // Performance trend calculation
      const recentRaces = Math.min(3, races);
      const recentPerformance = calculateRecentPerformance(driver.name, processedRaces, recentRaces);
      
      // Efficiency score (points per grid position)
      const efficiency = driver.avgQuali > 0 ? (pointsPerRace / driver.avgQuali) * 10 : 0;
      
      // Overall performance score (0-100)
      const performanceScore = Math.min(100, 
        (driver.normPoints * 35) + 
        (driver.normQuali * 20) + 
        (driver.normFinish * 25) + 
        (consistency * 20)
      );

      // Race craft score (finishing position vs qualifying)
      const raceCraft = driver.avgQuali > 0 && driver.avgFinish > 0 
        ? Math.max(0, (driver.avgQuali - driver.avgFinish) * 10 + 50) 
        : 50;

      const enhancedDriver = {
        ...driver,
        pointsPerRace: pointsPerRace.toFixed(1),
        consistency: (consistency * 100).toFixed(1),
        recentPerformance,
        performanceScore: performanceScore.toFixed(1),
        efficiency: efficiency.toFixed(2),
        raceCraft: raceCraft.toFixed(1),
        color: getDriverColor(driver.name, driver.team)
      };

      allDriversList.push(enhancedDriver);
      return enhancedDriver;
    });
    
    enhancedDrivers.forEach((driver) => {
      if (!grouped[driver.team]) grouped[driver.team] = [];
      grouped[driver.team].push(driver);
    });

    // Handle teams with driver changes
    Object.keys(grouped).forEach(team => {
      const drivers = grouped[team];
      if (drivers.length > 2) {
        drivers.sort((a, b) => b.points - a.points);
        grouped[team] = drivers.slice(0, 2);
      }
    });

    // Sort all drivers and get top performers
    const sortedDrivers = allDriversList.sort((a, b) => b.points - a.points);
    const topPerformers = sortedDrivers.slice(0, 8);
    
    return { 
      teamStats: grouped, 
      allDrivers: sortedDrivers,
      driverPerformanceData: enhancedDrivers,
      topPerformers
    };
  }, [processedRaces]);

  // Enhanced chart data for driver performance scatter
  const performanceScatterData = useMemo(() => {
    if (!driverPerformanceData.length) return null;

    let filteredDrivers = selectedTeam 
      ? driverPerformanceData.filter(d => d.team === selectedTeam)
      : driverPerformanceData;

    if (showTopDriversOnly) {
      filteredDrivers = filteredDrivers.slice(0, 10);
    }

    return {
      datasets: [{
        label: 'Driver Performance Matrix',
        data: filteredDrivers.map(driver => ({
          x: parseFloat(driver.avgQuali || 15),
          y: parseFloat(driver.avgFinish || 15),
          label: driver.name,
          team: driver.team,
          points: driver.points,
          performanceScore: driver.performanceScore
        })),
        backgroundColor: filteredDrivers.map(driver => driver.color),
        borderColor: filteredDrivers.map(driver => driver.color),
        pointRadius: filteredDrivers.map(driver => Math.max(6, 4 + (driver.points / 25))),
        pointHoverRadius: 12
      }]
    };
  }, [driverPerformanceData, selectedTeam, showTopDriversOnly]);

  // Championship progression chart data
  const championshipProgressionData = useMemo(() => {
    if (!processedRaces.length || !allDrivers.length) return null;

    const driversToShow = (selectedTeam
      ? allDrivers.filter(d => d.team === selectedTeam)
      : allDrivers
    ).slice(0, 8);

    const cumulativeByDriver = new Map(allDrivers.map(driver => [driver.name, 0]));
    const pointsByDriver = new Map(allDrivers.map(driver => [driver.name, [0]]));
    const leaderPointsByRound = [0];

    processedRaces.forEach(race => {
      const roundPoints = new Map();

      ['sprint_results', 'race_results'].forEach(resultType => {
        race[resultType]?.forEach(({ driver, points }) => {
          roundPoints.set(driver, (roundPoints.get(driver) || 0) + (points || 0));
        });
      });

      allDrivers.forEach(driver => {
        const nextTotal = (cumulativeByDriver.get(driver.name) || 0) + (roundPoints.get(driver.name) || 0);
        cumulativeByDriver.set(driver.name, nextTotal);
        pointsByDriver.get(driver.name).push(nextTotal);
      });

      leaderPointsByRound.push(Math.max(0, ...cumulativeByDriver.values()));
    });

    const driverProgressions = driversToShow.map(driver => {
      const cumulativePoints = pointsByDriver.get(driver.name) ?? [0];
      const gapToLeader = cumulativePoints.map((points, index) => leaderPointsByRound[index] - points);

      return {
        label: driver.name,
        data: gapToLeader,
        cumulativePoints,
        borderColor: driver.color,
        backgroundColor: driver.color + '20',
        borderWidth: 3,
        pointRadius: 4,
        pointHoverRadius: 8,
        tension: 0.2,
        fill: false
      };
    });

    const labels = ['Pre-Season', ...processedRaces.map((race, index) => `R${index + 1}`)];

    return {
      labels,
      datasets: driverProgressions
    };
  }, [processedRaces, allDrivers, selectedTeam]);

  // Radar chart data for top performers comparison
  const radarData = useMemo(() => {
    if (!showRadarChart || topPerformers.length === 0) return null;

    const topDriversForRadar = selectedTeam 
      ? topPerformers.filter(d => d.team === selectedTeam).slice(0, 3)
      : topPerformers.slice(0, 5);

    return {
      labels: ['Speed', 'Consistency', 'Race Craft', 'Qualifying', 'Points', 'Recent Form'],
      datasets: topDriversForRadar.map(driver => ({
        label: driver.name,
        data: [
          parseFloat(driver.performanceScore),
          parseFloat(driver.consistency),
          parseFloat(driver.raceCraft),
          (1 - driver.normQuali) * 100,
          driver.normPoints * 100,
          parseFloat(driver.recentPerformance) * 5
        ],
        backgroundColor: driver.color + '20',
        borderColor: driver.color,
        borderWidth: 2,
        pointBackgroundColor: driver.color,
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: driver.color
      }))
    };
  }, [showRadarChart, topPerformers, selectedTeam]);

  // Enhanced team comparison data
  const teamComparisonData = useMemo(() => {
    if (analysisType !== 'comparison' || Object.keys(teamStats).length === 0) return null;

    const teamToShow = selectedTeam ? [selectedTeam] : Object.keys(teamStats);
    const datasets = [];

    teamToShow.forEach(team => {
      const drivers = teamStats[team];
      if (drivers && drivers.length >= 2) {
        const [d1, d2] = drivers;
        
        datasets.push({
          label: d1.name,
          data: [
            parseFloat(d1.performanceScore),
            parseFloat(d1.consistency), 
            parseFloat(d1.efficiency),
            parseFloat(d1.raceCraft)
          ],
          backgroundColor: d1.color,
          borderColor: d1.color,
          borderWidth: 2
        });

        datasets.push({
          label: d2.name,
          data: [
            parseFloat(d2.performanceScore),
            parseFloat(d2.consistency),
            parseFloat(d2.efficiency), 
            parseFloat(d2.raceCraft)
          ],
          backgroundColor: d2.color,
          borderColor: d2.color,
          borderWidth: 2
        });
      }
    });

    return {
      labels: ['Performance', 'Consistency', 'Efficiency', 'Race Craft'],
      datasets
    };
  }, [analysisType, teamStats, selectedTeam]);

  // Sort drivers based on selected criteria
  const sortedDrivers = useMemo(() => {
    if (!allDrivers.length) return [];
    
    return [...allDrivers].sort((a, b) => {
      switch (sortBy) {
        case 'points': return b.points - a.points;
        case 'performance': return parseFloat(b.performanceScore) - parseFloat(a.performanceScore);
        case 'consistency': return parseFloat(b.consistency) - parseFloat(a.consistency);
        case 'efficiency': return parseFloat(b.efficiency) - parseFloat(a.efficiency);
        case 'recent': return parseFloat(b.recentPerformance) - parseFloat(a.recentPerformance);
        default: return b.points - a.points;
      }
    });
  }, [allDrivers, sortBy]);

  // Statistics for the stats grid
  const statsData = useMemo(() => {
    if (!allDrivers.length) return [];

    const avgPerformance = allDrivers.reduce((sum, d) => sum + parseFloat(d.performanceScore), 0) / allDrivers.length;
    const avgConsistency = allDrivers.reduce((sum, d) => sum + parseFloat(d.consistency), 0) / allDrivers.length;
    const totalPoints = allDrivers.reduce((sum, d) => sum + d.points, 0);
    const avgPointsPerRace = allDrivers.reduce((sum, d) => sum + parseFloat(d.pointsPerRace), 0) / allDrivers.length;

    return [
      {
        label: 'Average Performance',
        value: avgPerformance.toFixed(1),
        sublabel: 'Composite Score',
        color: 'blue'
      },
      {
        label: 'Average Consistency', 
        value: avgConsistency.toFixed(1),
        sublabel: 'Stability Rating',
        color: 'green'
      },
      {
        label: 'Total Points',
        value: totalPoints.toString(),
        sublabel: 'Season Total',
        color: 'yellow'
      },
      {
        label: 'Avg Points/Race',
        value: avgPointsPerRace.toFixed(1),
        sublabel: 'Per Race Average',
        color: 'purple'
      }
    ];
  }, [allDrivers]);

  // Chart options
  const scatterOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: {
        display: true,
        text: 'Driver Performance Matrix: Qualifying vs Race Results',
        font: { size: isMobile ? 14 : 16 },
        color: 'white'
      },
      legend: {
        display: false
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: 'white',
        bodyColor: 'white',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        callbacks: {
          label: (context) => {
            const point = context.raw;
            return [
              `${point.label} (${point.team})`,
              `Avg Qualifying: P${point.x.toFixed(1)}`,
              `Avg Finish: P${point.y.toFixed(1)}`,
              `Points: ${point.points}`,
              `Performance Score: ${point.performanceScore}/100`
            ];
          }
        }
      }
    },
    scales: {
      x: {
        title: { 
          display: true, 
          text: 'Average Qualifying Position (Better →)', 
          color: 'white' 
        },
        reverse: true,
        min: 1,
        max: 20,
        ticks: { color: 'white' },
        grid: { color: 'rgba(255, 255, 255, 0.1)' }
      },
      y: {
        title: { 
          display: true, 
          text: 'Average Race Finish (Better ↑)', 
          color: 'white' 
        },
        reverse: true,
        min: 1,
        max: 20,
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
        text: 'Top 8 Gap to Championship Leader',
        font: { size: isMobile ? 14 : 16 },
        color: 'white'
      },
      legend: {
        display: true,
        position: 'top',
        labels: { 
          color: 'white',
          font: { size: isMobile ? 10 : 12 },
          usePointStyle: true,
          pointStyle: 'line'
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: 'white',
        bodyColor: 'white',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        callbacks: {
          label: (context) => {
            const driverName = context.dataset.label;
            const gap = Number(context.raw);
            const points = context.dataset.cumulativePoints?.[context.dataIndex] ?? 0;
            const round = context.label;
            if (gap === 0) {
              return `${driverName}: leader, ${points} pts after ${round}`;
            }
            return `${driverName}: ${gap} pts behind, ${points} pts after ${round}`;
          }
        }
      }
    },
    scales: {
      x: {
        title: { 
          display: true, 
          text: 'Season Progression', 
          color: 'white' 
        },
        ticks: { 
          color: 'white',
          maxRotation: isMobile ? 45 : 0
        },
        grid: { color: 'rgba(255, 255, 255, 0.1)' }
      },
      y: {
        title: { 
          display: true, 
          text: 'Points Behind Leader', 
          color: 'white' 
        },
        beginAtZero: true,
        reverse: true,
        ticks: {
          color: 'white',
          callback: (value) => Number(value) === 0 ? 'Leader' : `+${value}`
        },
        grid: { color: 'rgba(255, 255, 255, 0.1)' }
      }
    },
    interaction: {
      intersect: false,
      mode: 'index'
    }
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: {
        display: true,
        text: 'Driver Performance Metrics',
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
        max: 100,
        ticks: { color: 'white' },
        grid: { color: 'rgba(255, 255, 255, 0.1)' }
      }
    }
  };

  const radarOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: {
        display: true,
        text: 'Multi-Dimensional Driver Analysis',
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
        max: 100,
        ticks: { 
          color: 'white',
          backdropColor: 'transparent'
        },
        grid: { color: 'rgba(255, 255, 255, 0.2)' },
        angleLines: { color: 'rgba(255, 255, 255, 0.2)' },
        pointLabels: { 
          color: 'white',
          font: { size: isMobile ? 10 : 12 }
        }
      }
    }
  };

  const teamList = Object.keys(teamStats).sort();

  return (
    <F1PageLayout
      title="Driver Performance Analytics"
      subtitle={`Comprehensive statistical analysis and performance metrics for the ${selectedYear} season`}
      className="enhanced-driver-stats"
    >
      {/* Enhanced Controls */}
      <ControlBar>
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
          <option value="performance">Performance Analysis</option>
          <option value="comparison">Team Comparison</option>
        </select>

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
            minWidth: "180px"
          }}
        >
          <option value="">All Teams</option>
          {teamList.map(team => (
            <option key={team} value={team}>{team}</option>
          ))}
        </select>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          style={{
            padding: "0.75rem",
            fontSize: "1rem",
            borderRadius: "6px",
            border: "1px solid #555",
            backgroundColor: "#333",
            color: "#fff"
          }}
        >
          <option value="points">Sort by Points</option>
          <option value="performance">Sort by Performance</option>
          <option value="consistency">Sort by Consistency</option>
          <option value="efficiency">Sort by Efficiency</option>
          <option value="recent">Sort by Recent Form</option>
        </select>

        <ToggleSwitch
          checked={showRadarChart}
          onChange={(e) => setShowRadarChart(e.target.checked)}
          label="Radar Analysis"
        />

        <ToggleSwitch
          checked={showTopDriversOnly}
          onChange={(e) => setShowTopDriversOnly(e.target.checked)}
          label="Top 10 Only"
        />
      </ControlBar>

      {/* Statistics Grid */}
      <StatsGrid stats={statsData} className="driver-performance-stats" />

      {/* Main Analytics Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : showRadarChart ? 'repeat(auto-fit, minmax(400px, 1fr))' : analysisType === 'performance' ? '1fr 1fr' : '1fr',
        gap: '2rem',
        marginBottom: '2rem'
      }}>
        {/* Performance Scatter Plot */}
        {performanceScatterData && analysisType === 'performance' && (
          <div style={{
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '8px',
            padding: '1rem',
            height: '500px'
          }}>
            <Scatter data={performanceScatterData} options={scatterOptions} />
          </div>
        )}

        {/* Championship Progression Chart */}
        {championshipProgressionData && analysisType === 'performance' && (
          <div style={{
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '8px',
            padding: '1rem',
            height: '500px'
          }}>
            <Line data={championshipProgressionData} options={progressionOptions} />
          </div>
        )}

        {/* Team Comparison Chart */}
        {teamComparisonData && analysisType === 'comparison' && (
          <div style={{
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '8px',
            padding: '1rem',
            height: '500px',
            gridColumn: isMobile ? '1' : '1 / -1' // Full width for comparison mode
          }}>
            <Bar data={teamComparisonData} options={barOptions} />
          </div>
        )}

        {/* Radar Chart */}
        {radarData && showRadarChart && (
          <div style={{
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '8px',
            padding: '1rem',
            height: '500px'
          }}>
            <Radar data={radarData} options={radarOptions} />
          </div>
        )}
      </div>

      {/* Driver Rankings Table */}
      <div style={{
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: '8px',
        padding: '1.5rem',
        marginTop: '2rem'
      }}>
        <h3 style={{ color: '#fff', marginBottom: '1.5rem', fontSize: '1.2rem' }}>
          📈 Driver Performance Rankings
        </h3>
        
        {isMobile ? (
          /* Mobile Card Layout */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {sortedDrivers.slice(0, showTopDriversOnly ? 10 : sortedDrivers.length).map((driver, index) => (
              <div key={driver.name} style={{
                background: 'rgba(0, 0, 0, 0.3)',
                borderRadius: '8px',
                padding: '1.5rem',
                border: `2px solid ${driver.color}`,
                position: 'relative'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: driver.color }}>
                      #{index + 1} {driver.name}
                    </div>
                    <div style={{ fontSize: '0.9rem', color: '#ccc' }}>{driver.team}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#fff' }}>
                      {driver.points} pts
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#aaa' }}>
                      {driver.pointsPerRace}/race
                    </div>
                  </div>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.85rem' }}>
                  <div>
                    <span style={{ color: '#aaa' }}>Performance:</span>
                    <div style={{ fontWeight: 'bold', color: '#fff' }}>{driver.performanceScore}/100</div>
                  </div>
                  <div>
                    <span style={{ color: '#aaa' }}>Consistency:</span>
                    <div style={{ fontWeight: 'bold', color: '#fff' }}>{driver.consistency}%</div>
                  </div>
                  <div>
                    <span style={{ color: '#aaa' }}>Avg Quali:</span>
                    <div style={{ fontWeight: 'bold', color: '#fff' }}>P{driver.avgQuali?.toFixed(1)}</div>
                  </div>
                  <div>
                    <span style={{ color: '#aaa' }}>Avg Finish:</span>
                    <div style={{ fontWeight: 'bold', color: '#fff' }}>P{driver.avgFinish?.toFixed(1)}</div>
                  </div>
                  <div>
                    <span style={{ color: '#aaa' }}>Efficiency:</span>
                    <div style={{ fontWeight: 'bold', color: '#fff' }}>{driver.efficiency}</div>
                  </div>
                  <div>
                    <span style={{ color: '#aaa' }}>Recent Form:</span>
                    <div style={{ fontWeight: 'bold', color: '#fff' }}>{driver.recentPerformance} pts/race</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Desktop Table Layout */
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}>
                  <th style={{ padding: '1rem', textAlign: 'left', color: '#fff', fontWeight: 'bold' }}>Rank</th>
                  <th style={{ padding: '1rem', textAlign: 'left', color: '#fff', fontWeight: 'bold' }}>Driver</th>
                  <th style={{ padding: '1rem', textAlign: 'left', color: '#fff', fontWeight: 'bold' }}>Team</th>
                  <th style={{ padding: '1rem', textAlign: 'center', color: '#fff', fontWeight: 'bold' }}>Points</th>
                  <th style={{ padding: '1rem', textAlign: 'center', color: '#fff', fontWeight: 'bold' }}>Performance</th>
                  <th style={{ padding: '1rem', textAlign: 'center', color: '#fff', fontWeight: 'bold' }}>Consistency</th>
                  <th style={{ padding: '1rem', textAlign: 'center', color: '#fff', fontWeight: 'bold' }}>Efficiency</th>
                  <th style={{ padding: '1rem', textAlign: 'center', color: '#fff', fontWeight: 'bold' }}>Race Craft</th>
                  <th style={{ padding: '1rem', textAlign: 'center', color: '#fff', fontWeight: 'bold' }}>Recent Form</th>
                </tr>
              </thead>
              <tbody>
                {sortedDrivers.slice(0, showTopDriversOnly ? 10 : sortedDrivers.length).map((driver, index) => (
                  <tr key={driver.name} style={{ 
                    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                    backgroundColor: index % 2 === 0 ? 'rgba(255, 255, 255, 0.02)' : 'transparent'
                  }}>
                    <td style={{ padding: '1rem', color: '#fff', fontWeight: 'bold' }}>#{index + 1}</td>
                    <td style={{ padding: '1rem', color: driver.color, fontWeight: 'bold' }}>{driver.name}</td>
                    <td style={{ padding: '1rem', color: '#ccc' }}>{driver.team}</td>
                    <td style={{ padding: '1rem', textAlign: 'center', color: '#fff', fontWeight: 'bold' }}>{driver.points}</td>
                    <td style={{ padding: '1rem', textAlign: 'center', color: '#fff' }}>{driver.performanceScore}/100</td>
                    <td style={{ padding: '1rem', textAlign: 'center', color: '#fff' }}>{driver.consistency}%</td>
                    <td style={{ padding: '1rem', textAlign: 'center', color: '#fff' }}>{driver.efficiency}</td>
                    <td style={{ padding: '1rem', textAlign: 'center', color: '#fff' }}>{driver.raceCraft}</td>
                    <td style={{ padding: '1rem', textAlign: 'center', color: '#fff' }}>{driver.recentPerformance}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </F1PageLayout>
  );
};

export default DriverStatsPage;
