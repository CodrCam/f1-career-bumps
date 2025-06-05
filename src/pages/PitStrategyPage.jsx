import React, { useState, useEffect, useMemo } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, BarElement } from 'chart.js';
import { Scatter, Bar, Line } from 'react-chartjs-2';
import { F1PageLayout, ResponsiveChart, StatsGrid } from '../components/ChartComponents.jsx';
import { SessionSelector, ControlBar, ToggleSwitch } from '../components/UIControls.jsx';
import { DataLoader, ErrorMessage, ChartLoadingSkeleton } from '../components/LoadingStates';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, BarElement);

// Custom hook for pit strategy data
const usePitStrategyData = () => {
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState('');
  const [sessionData, setSessionData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pitStats, setPitStats] = useState({});
  const [initialLoading, setInitialLoading] = useState(true);

  const apiBase = 'https://api.openf1.org/v1';

  const loadSessions = async () => {
    try {
      setInitialLoading(true);
      setError('');
      
      const response = await fetch(`${apiBase}/sessions?year=2025`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      const raceSessions = data.filter(s => 
        s.session_name === 'Race' || s.session_name === 'Sprint'
      ).slice(-15);
      
      if (raceSessions.length === 0) {
        throw new Error('No race sessions found for 2025');
      }
      
      setSessions(raceSessions);
    } catch (err) {
      console.error('Failed to load sessions:', err);
      setError(`Failed to load sessions: ${err.message}`);
    } finally {
      setInitialLoading(false);
    }
  };

  const loadSessionData = async () => {
    if (!selectedSession) {
      setError('Please select a session');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const [pitResponse, driversResponse, lapsResponse] = await Promise.all([
        fetch(`${apiBase}/pit?session_key=${selectedSession}`),
        fetch(`${apiBase}/drivers?session_key=${selectedSession}`),
        fetch(`${apiBase}/laps?session_key=${selectedSession}`)
      ]);

      if (!pitResponse.ok) {
        throw new Error(`Failed to fetch pit data: HTTP ${pitResponse.status}`);
      }
      
      if (!driversResponse.ok) {
        throw new Error(`Failed to fetch driver data: HTTP ${driversResponse.status}`);
      }
      
      if (!lapsResponse.ok) {
        throw new Error(`Failed to fetch lap data: HTTP ${lapsResponse.status}`);
      }

      const pits = await pitResponse.json();
      const drivers = await driversResponse.json();
      const laps = await lapsResponse.json();

      if (!Array.isArray(pits) || !Array.isArray(drivers) || !Array.isArray(laps)) {
        throw new Error('Invalid data format received from API');
      }

      if (drivers.length === 0) {
        setError('No driver data available for this session');
        return;
      }

      setSessionData({ pits, drivers, laps });
      calculatePitStats(pits, drivers);
    } catch (err) {
      console.error('Failed to load session data:', err);
      setError(`Failed to load session data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const calculatePitStats = (pits, drivers) => {
    try {
      const stats = {
        totalPitStops: pits.length,
        averagePitTime: 0,
        fastestPitStop: null,
        slowestPitStop: null,
        pitsByDriver: {},
        sessionFastest: null,
        sessionAverage: 0
      };

      if (pits.length === 0) {
        setPitStats(stats);
        return;
      }

      const validPits = pits.filter(pit => pit.pit_duration && pit.pit_duration > 0);
      
      if (validPits.length > 0) {
        stats.averagePitTime = validPits.reduce((sum, pit) => sum + pit.pit_duration, 0) / validPits.length;
        stats.sessionAverage = stats.averagePitTime;
        
        stats.fastestPitStop = validPits.reduce((fastest, pit) => 
          (!fastest || pit.pit_duration < fastest.pit_duration) ? pit : fastest
        );
        stats.sessionFastest = stats.fastestPitStop.pit_duration;
        
        stats.slowestPitStop = validPits.reduce((slowest, pit) => 
          (!slowest || pit.pit_duration > slowest.pit_duration) ? pit : slowest
        );
      }

      // Group by driver with enhanced analytics
      pits.forEach(pit => {
        const driverNum = pit.driver_number;
        if (!stats.pitsByDriver[driverNum]) {
          stats.pitsByDriver[driverNum] = {
            stops: [],
            average: 0,
            fastest: null,
            consistency: 0,
            relativeToBest: 0,
            relativeToAverage: 0
          };
        }
        stats.pitsByDriver[driverNum].stops.push(pit);
      });

      // Calculate advanced metrics for each driver
      Object.keys(stats.pitsByDriver).forEach(driverNum => {
        const driverPits = stats.pitsByDriver[driverNum];
        const validStops = driverPits.stops.filter(p => p.pit_duration && p.pit_duration > 0);
        
        if (validStops.length > 0) {
          driverPits.average = validStops.reduce((sum, p) => sum + p.pit_duration, 0) / validStops.length;
          driverPits.fastest = Math.min(...validStops.map(p => p.pit_duration));
          
          // Calculate consistency (standard deviation)
          const variance = validStops.reduce((sum, p) => sum + Math.pow(p.pit_duration - driverPits.average, 2), 0) / validStops.length;
          driverPits.consistency = Math.sqrt(variance);
          
          // Relative performance metrics
          driverPits.relativeToBest = ((driverPits.average - stats.sessionFastest) / stats.sessionFastest) * 100;
          driverPits.relativeToAverage = ((driverPits.average - stats.sessionAverage) / stats.sessionAverage) * 100;
        }
      });

      setPitStats(stats);
    } catch (err) {
      console.error('Error calculating pit stats:', err);
      setPitStats({
        totalPitStops: 0,
        averagePitTime: 0,
        fastestPitStop: null,
        slowestPitStop: null,
        pitsByDriver: {},
        sessionFastest: null,
        sessionAverage: 0
      });
    }
  };

  return {
    sessions,
    selectedSession,
    setSelectedSession,
    sessionData,
    loading,
    error,
    pitStats,
    initialLoading,
    loadSessions,
    loadSessionData
  };
};

// Enhanced relative performance chart data
const useRelativePerformanceData = (sessionData, pitStats) => {
  const driverColors = {
    // Ferrari
    'HAM': '#DC143C', 'LEC': '#DC143C', 
    // Red Bull Racing
    'VER': '#0600EF', 'TSU': '#0600EF', 
    // McLaren
    'NOR': '#FF8700', 'PIA': '#FF8700', 
    // Mercedes
    'RUS': '#00D2BE', 'ANT': '#00D2BE', 
    // Aston Martin
    'ALO': '#006F62', 'STR': '#006F62', 
    // Alpine
    'GAS': '#0090FF', 'COL': '#0090FF', 'DOO': '#0090FF',
    // Williams
    'ALB': '#005AFF', 'SAI': '#005AFF', 
    // Haas
    'OCO': '#B6BABD', 'BEA': '#B6BABD', 
    // Racing Bulls
    'HAD': '#2B4562', 'LAW': '#2B4562', 
    // Kick Sauber
    'HUL': '#00F500', 'BOR': '#00F500',
    // Additional fallback colors for any extra drivers
    'KVY': '#9932CC', 'RIC': '#FF4500', 'MAG': '#8B0000', 'ZHO': '#FF69B4'
  };

  return useMemo(() => {
    if (!sessionData.pits || !sessionData.drivers || Object.keys(pitStats.pitsByDriver || {}).length === 0) {
      return null;
    }

    try {
      const driversWithData = Object.keys(pitStats.pitsByDriver)
        .filter(driverNum => pitStats.pitsByDriver[driverNum].average > 0)
        .sort((a, b) => pitStats.pitsByDriver[a].average - pitStats.pitsByDriver[b].average);

      if (driversWithData.length === 0) return null;

      // Create relative performance data (percentage faster/slower than session average)
      return {
        labels: driversWithData.map(driverNum => {
          const driver = sessionData.drivers.find(d => d.driver_number == driverNum);
          return driver?.name_acronym || `#${driverNum}`;
        }),
        datasets: [{
          label: 'Performance vs Session Average (%)',
          data: driversWithData.map(driverNum => pitStats.pitsByDriver[driverNum].relativeToAverage),
          backgroundColor: driversWithData.map((driverNum, index) => {
            const driver = sessionData.drivers.find(d => d.driver_number == driverNum);
            const relativePerf = pitStats.pitsByDriver[driverNum].relativeToAverage;
            const baseColor = driverColors[driver?.name_acronym] || `hsl(${index * 40}, 70%, 50%)`;
            
            // Add performance-based opacity
            const opacity = relativePerf < -2 ? '90' : relativePerf < 0 ? '70' : relativePerf < 2 ? '50' : '30';
            return baseColor + opacity;
          }),
          borderColor: driversWithData.map((driverNum, index) => {
            const driver = sessionData.drivers.find(d => d.driver_number == driverNum);
            return driverColors[driver?.name_acronym] || `hsl(${index * 40}, 70%, 50%)`;
          }),
          borderWidth: 3
        }]
      };
    } catch (err) {
      console.error('Error creating relative performance data:', err);
      return null;
    }
  }, [sessionData, pitStats]);
};

// Enhanced precision time comparison chart
const usePrecisionTimeData = (sessionData, pitStats) => {
  const driverColors = {
    // Ferrari
    'HAM': '#DC143C', 'LEC': '#DC143C', 
    // Red Bull Racing
    'VER': '#0600EF', 'TSU': '#0600EF', 
    // McLaren
    'NOR': '#FF8700', 'PIA': '#FF8700', 
    // Mercedes
    'RUS': '#00D2BE', 'ANT': '#00D2BE', 
    // Aston Martin
    'ALO': '#006F62', 'STR': '#006F62', 
    // Alpine
    'GAS': '#0090FF', 'COL': '#0090FF', 'DOO': '#0090FF',
    // Williams
    'ALB': '#005AFF', 'SAI': '#005AFF', 
    // Haas
    'OCO': '#B6BABD', 'BEA': '#B6BABD', 
    // Racing Bulls
    'HAD': '#2B4562', 'LAW': '#2B4562', 
    // Kick Sauber
    'HUL': '#00F500', 'BOR': '#00F500',
    // Additional fallback colors for any extra drivers
    'KVY': '#9932CC', 'RIC': '#FF4500', 'MAG': '#8B0000', 'ZHO': '#FF69B4'
  };

  return useMemo(() => {
    if (!sessionData.pits || !sessionData.drivers || Object.keys(pitStats.pitsByDriver || {}).length === 0) {
      return null;
    }

    try {
      const driversWithData = Object.keys(pitStats.pitsByDriver)
        .filter(driverNum => pitStats.pitsByDriver[driverNum].average > 0)
        .sort((a, b) => pitStats.pitsByDriver[a].average - pitStats.pitsByDriver[b].average);

      if (driversWithData.length === 0) return null;

      const fastestTime = Math.min(...driversWithData.map(driverNum => pitStats.pitsByDriver[driverNum].average));

      return {
        labels: driversWithData.map(driverNum => {
          const driver = sessionData.drivers.find(d => d.driver_number == driverNum);
          return driver?.name_acronym || `#${driverNum}`;
        }),
        datasets: [
          {
            label: 'Time Delta from Fastest (seconds)',
            data: driversWithData.map(driverNum => {
              const avgTime = pitStats.pitsByDriver[driverNum].average;
              return (avgTime - fastestTime).toFixed(3);
            }),
            backgroundColor: driversWithData.map((driverNum, index) => {
              const driver = sessionData.drivers.find(d => d.driver_number == driverNum);
              const delta = pitStats.pitsByDriver[driverNum].average - fastestTime;
              
              // Color gradient based on performance
              let opacity;
              if (delta < 0.1) opacity = '90';
              else if (delta < 0.3) opacity = '70';
              else if (delta < 0.5) opacity = '50';
              else opacity = '30';
              
              const baseColor = driverColors[driver?.name_acronym] || `hsl(${index * 40}, 70%, 50%)`;
              return baseColor + opacity;
            }),
            borderColor: driversWithData.map((driverNum, index) => {
              const driver = sessionData.drivers.find(d => d.driver_number == driverNum);
              return driverColors[driver?.name_acronym] || `hsl(${index * 40}, 70%, 50%)`;
            }),
            borderWidth: 2
          },
          {
            label: 'Consistency (Std Dev)',
            data: driversWithData.map(driverNum => pitStats.pitsByDriver[driverNum].consistency.toFixed(3)),
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            borderColor: 'rgba(255, 255, 255, 0.5)',
            borderWidth: 1,
            type: 'line',
            yAxisID: 'y1',
            pointRadius: 4,
            pointHoverRadius: 6
          }
        ]
      };
    } catch (err) {
      console.error('Error creating precision time data:', err);
      return null;
    }
  }, [sessionData, pitStats]);
};

// Enhanced scatter plot with better scaling
const useEnhancedScatterData = (sessionData, pitStats) => {
  const driverColors = {
    // Ferrari
    'HAM': '#DC143C', 'LEC': '#DC143C', 
    // Red Bull Racing
    'VER': '#0600EF', 'TSU': '#0600EF', 
    // McLaren
    'NOR': '#FF8700', 'PIA': '#FF8700', 
    // Mercedes
    'RUS': '#00D2BE', 'ANT': '#00D2BE', 
    // Aston Martin
    'ALO': '#006F62', 'STR': '#006F62', 
    // Alpine
    'GAS': '#0090FF', 'COL': '#0090FF', 'DOO': '#0090FF',
    // Williams
    'ALB': '#005AFF', 'SAI': '#005AFF', 
    // Haas
    'OCO': '#B6BABD', 'BEA': '#B6BABD', 
    // Racing Bulls
    'HAD': '#2B4562', 'LAW': '#2B4562', 
    // Kick Sauber
    'HUL': '#00F500', 'BOR': '#00F500',
    // Additional fallback colors for any extra drivers
    'KVY': '#9932CC', 'RIC': '#FF4500', 'MAG': '#8B0000', 'ZHO': '#FF69B4'
  };

  return useMemo(() => {
    if (!sessionData.pits || !sessionData.drivers) return null;

    try {
      const datasets = [];
      const driverPits = {};

      // Group pit stops by driver
      sessionData.pits.forEach(pit => {
        if (!driverPits[pit.driver_number]) {
          driverPits[pit.driver_number] = [];
        }
        driverPits[pit.driver_number].push(pit);
      });

      Object.keys(driverPits).forEach((driverNum, index) => {
        const driver = sessionData.drivers.find(d => d.driver_number == driverNum);
        const driverName = driver?.name_acronym || `#${driverNum}`;
        const driverData = pitStats.pitsByDriver?.[driverNum];
        
        datasets.push({
          label: driverName,
          data: driverPits[driverNum]
            .filter(pit => pit.lap_number && pit.pit_duration)
            .map(pit => {
              const relativeTime = pitStats.sessionFastest ? 
                ((pit.pit_duration - pitStats.sessionFastest) * 1000) : pit.pit_duration; // Convert to milliseconds for better visibility
              
              return {
                x: pit.lap_number,
                y: relativeTime,
                actualTime: pit.pit_duration,
                fastestGap: pitStats.sessionFastest ? (pit.pit_duration - pitStats.sessionFastest).toFixed(3) : 'N/A'
              };
            }),
          backgroundColor: driverColors[driverName] || `hsl(${index * 30}, 70%, 50%)`,
          borderColor: driverColors[driverName] || `hsl(${index * 30}, 70%, 50%)`,
          pointRadius: 10,
          pointHoverRadius: 14
        });
      });

      return { datasets };
    } catch (err) {
      console.error('Error creating enhanced scatter data:', err);
      return null;
    }
  }, [sessionData, pitStats]);
};

const PitStrategyPage = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [visualizationType, setVisualizationType] = useState('relative'); // 'relative', 'precision', 'scatter'
  const [showConsistency, setShowConsistency] = useState(false);
  
  const {
    sessions,
    selectedSession,
    setSelectedSession,
    sessionData,
    loading,
    error,
    pitStats,
    initialLoading,
    loadSessions,
    loadSessionData
  } = usePitStrategyData();

  const relativeData = useRelativePerformanceData(sessionData, pitStats);
  const precisionData = usePrecisionTimeData(sessionData, pitStats);
  const scatterData = useEnhancedScatterData(sessionData, pitStats);

  useEffect(() => {
    loadSessions();
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const formatTime = (seconds) => {
    if (!seconds || seconds === 0) return '--:--';
    return `${seconds.toFixed(3)}s`;
  };

  const formatDelta = (delta) => {
    if (!delta && delta !== 0) return '--';
    const sign = delta >= 0 ? '+' : '';
    return `${sign}${delta.toFixed(3)}s`;
  };

  // Chart options for relative performance
  const relativeOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: {
        display: true,
        text: 'Performance vs Session Average (Critical F1 Differences)',
        color: 'white',
        font: { size: isMobile ? 14 : 16 }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        titleColor: 'white',
        bodyColor: 'white',
        borderColor: 'rgba(255, 255, 255, 0.2)',
        borderWidth: 1,
        callbacks: {
          label: (context) => {
            const value = parseFloat(context.raw);
            const driver = context.label;
            const driverNum = Object.keys(pitStats.pitsByDriver).find(num => {
              const d = sessionData.drivers?.find(dr => dr.driver_number == num);
              return (d?.name_acronym || `#${num}`) === driver;
            });
            
            if (driverNum) {
              const driverData = pitStats.pitsByDriver[driverNum];
              return [
                `${driver}`,
                `Average: ${formatTime(driverData.average)}`,
                `vs Session Avg: ${value >= 0 ? '+' : ''}${value.toFixed(2)}%`,
                `Consistency: ±${formatTime(driverData.consistency)}`,
                `vs Fastest: ${formatDelta(driverData.average - pitStats.sessionFastest)}`
              ];
            }
            return `${driver}: ${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
          }
        }
      }
    },
    scales: {
      x: {
        ticks: { 
          color: 'white',
          maxRotation: isMobile ? 90 : 45, // Steeper rotation for more drivers
          minRotation: isMobile ? 45 : 0
        },
        grid: { color: 'rgba(255, 255, 255, 0.1)' }
      },
      y: {
        title: { 
          display: true, 
          text: 'Performance Difference (%)', 
          color: 'white' 
        },
        ticks: {
          color: 'white',
          callback: (value) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
        },
        grid: { color: 'rgba(255, 255, 255, 0.1)' },
        // Add zero line for reference
        plugins: {
          annotation: {
            annotations: {
              line1: {
                type: 'line',
                yMin: 0,
                yMax: 0,
                borderColor: 'rgba(255, 255, 255, 0.5)',
                borderWidth: 2,
                borderDash: [5, 5]
              }
            }
          }
        }
      }
    }
  };

  // Chart options for precision time comparison
  const precisionOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top',
        labels: { color: 'white' }
      },
      title: {
        display: true,
        text: 'Precision Time Analysis - Every Millisecond Matters',
        color: 'white',
        font: { size: isMobile ? 14 : 16 }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        titleColor: 'white',
        bodyColor: 'white',
        borderColor: 'rgba(255, 255, 255, 0.2)',
        borderWidth: 1
      }
    },
    scales: {
      x: {
        ticks: { 
          color: 'white',
          maxRotation: isMobile ? 90 : 45, // Better rotation for 20+ drivers
          minRotation: isMobile ? 45 : 0
        },
        grid: { color: 'rgba(255, 255, 255, 0.1)' }
      },
      y: {
        title: { 
          display: true, 
          text: 'Time Delta from Fastest (seconds)', 
          color: 'white' 
        },
        ticks: {
          color: 'white',
          callback: (value) => `+${parseFloat(value).toFixed(3)}s`
        },
        grid: { color: 'rgba(255, 255, 255, 0.1)' },
        beginAtZero: true
      },
      y1: {
        type: 'linear',
        display: showConsistency,
        position: 'right',
        title: { 
          display: true, 
          text: 'Consistency (Std Dev)', 
          color: 'white' 
        },
        ticks: { color: 'white' },
        grid: { drawOnChartArea: false }
      }
    }
  };

  // Enhanced scatter options
  const enhancedScatterOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: { color: 'white' }
      },
      title: {
        display: true,
        text: 'Pit Stop Timeline - Millisecond Precision View',
        color: 'white',
        font: { size: isMobile ? 14 : 16 }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        titleColor: 'white',
        bodyColor: 'white',
        borderColor: 'rgba(255, 255, 255, 0.2)',
        borderWidth: 1,
        callbacks: {
          label: (context) => {
            const driver = context.dataset.label;
            const lap = context.parsed.x;
            const relativeMs = context.parsed.y;
            const point = context.raw;
            
            return [
              `${driver}`,
              `Lap ${lap}`,
              `Actual Time: ${formatTime(point.actualTime)}`,
              `Gap to Fastest: ${point.fastestGap}s`,
              `Relative: ${relativeMs >= 0 ? '+' : ''}${relativeMs.toFixed(0)}ms`
            ];
          }
        }
      }
    },
    scales: {
      x: {
        title: { display: true, text: 'Lap Number', color: 'white' },
        ticks: { color: 'white' },
        grid: { color: 'rgba(255, 255, 255, 0.1)' }
      },
      y: {
        title: { 
          display: true, 
          text: 'Time Gap to Fastest (milliseconds)', 
          color: 'white' 
        },
        ticks: {
          color: 'white',
          callback: (value) => `${value >= 0 ? '+' : ''}${value.toFixed(0)}ms`
        },
        grid: { color: 'rgba(255, 255, 255, 0.1)' }
      }
    }
  };

  // Show initial loading screen
  if (initialLoading) {
    return (
      <F1PageLayout 
        title="⛽ Enhanced Pit Stop Strategy Analysis"
        showHeader={true}
      >
        <DataLoader 
          message="Loading F1 Sessions..." 
          submessage="Fetching race and sprint sessions from OpenF1 API"
        />
      </F1PageLayout>
    );
  }

  // Enhanced stats data for grid
  const statsData = Object.keys(pitStats).length > 0 ? [
    {
      label: 'Total Pit Stops',
      value: pitStats.totalPitStops.toString(),
      sublabel: 'in session',
      color: 'blue'
    },
    {
      label: 'Session Fastest',
      value: formatTime(pitStats.sessionFastest),
      sublabel: pitStats.fastestPitStop ? 
        sessionData.drivers?.find(d => d.driver_number == pitStats.fastestPitStop.driver_number)?.name_acronym || `#${pitStats.fastestPitStop.driver_number}`
        : 'N/A',
      color: 'yellow'
    },
    {
      label: 'Average Time',
      value: formatTime(pitStats.sessionAverage),
      sublabel: 'session average',
      color: 'green'
    },
    {
      label: 'Spread',
      value: pitStats.fastestPitStop && pitStats.slowestPitStop ? 
        formatTime(pitStats.slowestPitStop.pit_duration - pitStats.fastestPitStop.pit_duration) : '--:--',
      sublabel: 'fastest to slowest',
      color: 'red'
    }
  ] : [];

  return (
    <F1PageLayout 
      title="⛽ Enhanced Pit Stop Strategy Analysis"
      subtitle="Precision timing analysis where every millisecond counts"
      className="enhanced-pit-strategy-page"
    >
      {/* Enhanced Controls */}
      <ControlBar>
        <select
          value={visualizationType}
          onChange={(e) => setVisualizationType(e.target.value)}
          style={{
            padding: "0.75rem",
            fontSize: "1rem",
            borderRadius: "6px",
            border: "1px solid #555",
            backgroundColor: "#333",
            color: "#fff"
          }}
        >
          <option value="relative">Relative Performance</option>
          <option value="precision">Precision Timing</option>
          <option value="scatter">Timeline Analysis</option>
        </select>

        <ToggleSwitch
          checked={showConsistency}
          onChange={(e) => setShowConsistency(e.target.checked)}
          label="Show Consistency"
        />
      </ControlBar>

      {/* Session Controls */}
      <SessionSelector
        sessions={sessions}
        selectedSession={selectedSession}
        onSessionChange={setSelectedSession}
        onLoadData={loadSessionData}
        loading={loading}
        label="Select Race Session"
        buttonText="Load Data"
      />

      {/* Error Display */}
      {error && (
        <ErrorMessage
          title="Data Loading Error"
          message={error}
          onRetry={selectedSession ? loadSessionData : loadSessions}
        />
      )}

      {/* Enhanced Statistics Cards */}
      {statsData.length > 0 && (
        <StatsGrid stats={statsData} className="enhanced-pit-stats" />
      )}

      {/* Main Visualization */}
      {loading ? (
        <ChartLoadingSkeleton isMobile={isMobile} />
      ) : (
        <div style={{ marginBottom: '2rem' }}>
          {visualizationType === 'relative' && relativeData && (
            <div style={{
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '8px',
              padding: '1rem',
              height: isMobile ? '600px' : '700px' // Increased height for 20+ drivers
            }}>
              <Bar data={relativeData} options={relativeOptions} />
            </div>
          )}

          {visualizationType === 'precision' && precisionData && (
            <div style={{
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '8px',
              padding: '1rem',
              height: isMobile ? '600px' : '700px' // Increased height for 20+ drivers
            }}>
              <Bar data={precisionData} options={precisionOptions} />
            </div>
          )}

          {visualizationType === 'scatter' && scatterData && (
            <div style={{
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '8px',
              padding: '1rem',
              height: isMobile ? '600px' : '700px' // Increased height for 20+ drivers
            }}>
              <Scatter data={scatterData} options={enhancedScatterOptions} />
            </div>
          )}
        </div>
      )}

      {/* Enhanced Performance Table */}
      {Object.keys(pitStats.pitsByDriver || {}).length > 0 && (
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '8px',
          padding: '1.5rem',
          marginTop: '2rem'
        }}>
          <h3 style={{ color: '#fff', marginBottom: '1.5rem', fontSize: '1.1rem' }}>
            🏁 Precision Performance Analysis
          </h3>
          
          {isMobile ? (
            /* Mobile Card Layout */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {Object.keys(pitStats.pitsByDriver)
                .filter(driverNum => pitStats.pitsByDriver[driverNum].average > 0)
                .sort((a, b) => pitStats.pitsByDriver[a].average - pitStats.pitsByDriver[b].average)
                .map((driverNum, index) => {
                  const driverData = pitStats.pitsByDriver[driverNum];
                  const driver = sessionData.drivers?.find(d => d.driver_number == driverNum);
                  const driverName = driver?.name_acronym || `#${driverNum}`;
                  
                  return (
                    <div key={driverNum} style={{
                      background: 'rgba(0, 0, 0, 0.3)',
                      borderRadius: '8px',
                      padding: '1.5rem',
                      border: `2px solid ${index === 0 ? '#FFD700' : index < 3 ? '#C0C0C0' : 'rgba(255, 255, 255, 0.2)'}`,
                      position: 'relative'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                        <div>
                          <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#fff' }}>
                            #{index + 1} {driverName}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: '#ccc' }}>
                            {driverData.stops.length} stop{driverData.stops.length !== 1 ? 's' : ''}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#fff' }}>
                            {formatTime(driverData.average)}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: driverData.relativeToAverage >= 0 ? '#EF4444' : '#10B981' }}>
                            {driverData.relativeToAverage >= 0 ? '+' : ''}{driverData.relativeToAverage.toFixed(2)}%
                          </div>
                        </div>
                      </div>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.85rem' }}>
                        <div>
                          <span style={{ color: '#aaa' }}>Fastest:</span>
                          <div style={{ fontWeight: 'bold', color: '#fff' }}>{formatTime(driverData.fastest)}</div>
                        </div>
                        <div>
                          <span style={{ color: '#aaa' }}>vs Session Best:</span>
                          <div style={{ fontWeight: 'bold', color: '#fff' }}>
                            {formatDelta(driverData.average - pitStats.sessionFastest)}
                          </div>
                        </div>
                        <div>
                          <span style={{ color: '#aaa' }}>Consistency:</span>
                          <div style={{ fontWeight: 'bold', color: '#fff' }}>±{formatTime(driverData.consistency)}</div>
                        </div>
                        <div>
                          <span style={{ color: '#aaa' }}>Performance:</span>
                          <div style={{ 
                            fontWeight: 'bold', 
                            color: driverData.relativeToAverage < -1 ? '#10B981' : 
                                   driverData.relativeToAverage < 1 ? '#F59E0B' : '#EF4444'
                          }}>
                            {driverData.relativeToAverage < -1 ? 'Excellent' : 
                             driverData.relativeToAverage < 1 ? 'Good' : 'Needs Work'}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          ) : (
            /* Desktop Table Layout */
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}>
                    <th style={{ padding: '1rem', textAlign: 'left', color: '#fff', fontWeight: 'bold' }}>Pos</th>
                    <th style={{ padding: '1rem', textAlign: 'left', color: '#fff', fontWeight: 'bold' }}>Driver</th>
                    <th style={{ padding: '1rem', textAlign: 'center', color: '#fff', fontWeight: 'bold' }}>Avg Time</th>
                    <th style={{ padding: '1rem', textAlign: 'center', color: '#fff', fontWeight: 'bold' }}>Fastest</th>
                    <th style={{ padding: '1rem', textAlign: 'center', color: '#fff', fontWeight: 'bold' }}>vs Best</th>
                    <th style={{ padding: '1rem', textAlign: 'center', color: '#fff', fontWeight: 'bold' }}>vs Avg</th>
                    <th style={{ padding: '1rem', textAlign: 'center', color: '#fff', fontWeight: 'bold' }}>Consistency</th>
                    <th style={{ padding: '1rem', textAlign: 'center', color: '#fff', fontWeight: 'bold' }}>Stops</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(pitStats.pitsByDriver)
                    .filter(driverNum => pitStats.pitsByDriver[driverNum].average > 0)
                    .sort((a, b) => pitStats.pitsByDriver[a].average - pitStats.pitsByDriver[b].average)
                    .map((driverNum, index) => {
                      const driverData = pitStats.pitsByDriver[driverNum];
                      const driver = sessionData.drivers?.find(d => d.driver_number == driverNum);
                      const driverName = driver?.name_acronym || `#${driverNum}`;
                      
                      return (
                        <tr key={driverNum} style={{ 
                          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                          backgroundColor: index % 2 === 0 ? 'rgba(255, 255, 255, 0.02)' : 'transparent',
                          borderLeft: index === 0 ? '4px solid #FFD700' : index < 3 ? '4px solid #C0C0C0' : '4px solid transparent'
                        }}>
                          <td style={{ 
                            padding: '1rem', 
                            color: index === 0 ? '#FFD700' : '#fff', 
                            fontWeight: 'bold' 
                          }}>
                            #{index + 1}
                          </td>
                          <td style={{ padding: '1rem', color: '#fff', fontWeight: 'bold' }}>{driverName}</td>
                          <td style={{ padding: '1rem', textAlign: 'center', color: '#fff', fontWeight: 'bold' }}>
                            {formatTime(driverData.average)}
                          </td>
                          <td style={{ padding: '1rem', textAlign: 'center', color: '#10B981' }}>
                            {formatTime(driverData.fastest)}
                          </td>
                          <td style={{ padding: '1rem', textAlign: 'center', color: '#fff' }}>
                            {formatDelta(driverData.average - pitStats.sessionFastest)}
                          </td>
                          <td style={{ 
                            padding: '1rem', 
                            textAlign: 'center', 
                            color: driverData.relativeToAverage >= 0 ? '#EF4444' : '#10B981',
                            fontWeight: 'bold'
                          }}>
                            {driverData.relativeToAverage >= 0 ? '+' : ''}{driverData.relativeToAverage.toFixed(2)}%
                          </td>
                          <td style={{ padding: '1rem', textAlign: 'center', color: '#ccc' }}>
                            ±{formatTime(driverData.consistency)}
                          </td>
                          <td style={{ padding: '1rem', textAlign: 'center', color: '#ccc' }}>
                            {driverData.stops.length}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Enhanced Methodology */}
      <div style={{
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: '8px',
        padding: '2rem',
        marginTop: '2rem'
      }}>
        <h3 style={{ color: '#fff', marginBottom: '1rem' }}>🔬 Precision Analysis Methodology</h3>
        <div style={{ color: '#ccc', lineHeight: '1.6' }}>
          <p style={{ marginBottom: '1rem' }}>
            In Formula 1, pit stop differences of 0.01 seconds can determine race positions. Our enhanced visualization 
            techniques reveal these critical micro-differences that traditional charts obscure. <strong>Analysis includes 
            all 20-21 participating drivers</strong>, including mid-season replacements like Franco Colapinto.
          </p>
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
            gap: '1.5rem'
          }}>
            <div>
              <h4 style={{ color: '#60A5FA', marginBottom: '0.5rem' }}>Visualization Techniques:</h4>
              <ul style={{ listStyle: 'none', padding: 0 }}>
                <li>• <strong>Relative Performance</strong>: Percentage differences from session average</li>
                <li>• <strong>Precision Timing</strong>: Millisecond-accurate delta analysis</li>
                <li>• <strong>Enhanced Scaling</strong>: Amplified views of small time differences</li>
                <li>• <strong>Color Gradient Coding</strong>: Performance-based visual hierarchy</li>
              </ul>
            </div>
            <div>
              <h4 style={{ color: '#34D399', marginBottom: '0.5rem' }}>Advanced Metrics:</h4>
              <ul style={{ listStyle: 'none', padding: 0 }}>
                <li>• <strong>Consistency Analysis</strong>: Standard deviation tracking</li>
                <li>• <strong>Session Benchmarking</strong>: Multiple reference points</li>
                <li>• <strong>Strategic Context</strong>: Lap timing correlation</li>
                <li>• <strong>Performance Rankings</strong>: Precision-based standings</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </F1PageLayout>
  );
};

export default PitStrategyPage;