import React, { useState, useEffect, useMemo } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, BarElement } from 'chart.js';
import { Scatter, Bar } from 'react-chartjs-2';
import { F1PageLayout, ResponsiveChart, StatsGrid } from '../components/ChartComponents.jsx';
import { SessionSelector, ControlBar } from '../components/UIControls.jsx';
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
        pitsByDriver: {}
      };

      if (pits.length === 0) {
        setPitStats(stats);
        return;
      }

      const validPits = pits.filter(pit => pit.pit_duration && pit.pit_duration > 0);
      
      if (validPits.length > 0) {
        stats.averagePitTime = validPits.reduce((sum, pit) => sum + pit.pit_duration, 0) / validPits.length;
        stats.fastestPitStop = validPits.reduce((fastest, pit) => 
          (!fastest || pit.pit_duration < fastest.pit_duration) ? pit : fastest
        );
        stats.slowestPitStop = validPits.reduce((slowest, pit) => 
          (!slowest || pit.pit_duration > slowest.pit_duration) ? pit : slowest
        );
      }

      // Group by driver
      pits.forEach(pit => {
        const driverNum = pit.driver_number;
        if (!stats.pitsByDriver[driverNum]) {
          stats.pitsByDriver[driverNum] = [];
        }
        stats.pitsByDriver[driverNum].push(pit);
      });

      setPitStats(stats);
    } catch (err) {
      console.error('Error calculating pit stats:', err);
      setPitStats({
        totalPitStops: 0,
        averagePitTime: 0,
        fastestPitStop: null,
        slowestPitStop: null,
        pitsByDriver: {}
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

// Create chart data using useMemo
const usePitScatterData = (sessionData) => {
  const driverColors = {
    'HAM': '#DC143C', 'LEC': '#DC143C', // Ferrari
    'VER': '#0600EF', 'TSU': '#0600EF', // Red Bull Racing
    'NOR': '#FF8700', 'PIA': '#FF8700', // McLaren
    'RUS': '#00D2BE', 'ANT': '#00D2BE', // Mercedes
    'ALO': '#006F62', 'STR': '#006F62', // Aston Martin
    'GAS': '#0090FF', 'COL': '#0090FF', // Alpine
    'ALB': '#005AFF', 'SAI': '#005AFF', // Williams
    'OCO': '#B6BABD', 'BEA': '#B6BABD', // Haas
    'HAD': '#2B4562', 'LAW': '#2B4562', // Racing Bulls
    'HUL': '#00F500', 'BOR': '#00F500'  // Kick Sauber
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
        
        datasets.push({
          label: driverName,
          data: driverPits[driverNum]
            .filter(pit => pit.lap_number && pit.pit_duration)
            .map(pit => ({
              x: pit.lap_number,
              y: pit.pit_duration
            })),
          backgroundColor: driverColors[driverName] || `hsl(${index * 30}, 70%, 50%)`,
          borderColor: driverColors[driverName] || `hsl(${index * 30}, 70%, 50%)`,
          pointRadius: 8,
          pointHoverRadius: 10
        });
      });

      return { datasets };
    } catch (err) {
      console.error('Error creating scatter data:', err);
      return null;
    }
  }, [sessionData]);
};

const usePitDurationData = (sessionData, pitStats) => {
  const driverColors = {
    'HAM': '#DC143C', 'LEC': '#DC143C', // Ferrari
    'VER': '#0600EF', 'TSU': '#0600EF', // Red Bull Racing
    'NOR': '#FF8700', 'PIA': '#FF8700', // McLaren
    'RUS': '#00D2BE', 'ANT': '#00D2BE', // Mercedes
    'ALO': '#006F62', 'STR': '#006F62', // Aston Martin
    'GAS': '#0090FF', 'COL': '#0090FF', // Alpine
    'ALB': '#005AFF', 'SAI': '#005AFF', // Williams
    'OCO': '#B6BABD', 'BEA': '#B6BABD', // Haas
    'HAD': '#2B4562', 'LAW': '#2B4562', // Racing Bulls
    'HUL': '#00F500', 'BOR': '#00F500'  // Kick Sauber
  };

  return useMemo(() => {
    if (!sessionData.pits || !sessionData.drivers || Object.keys(pitStats.pitsByDriver || {}).length === 0) {
      return null;
    }

    try {
      const driverAvgTimes = {};
      Object.keys(pitStats.pitsByDriver).forEach(driverNum => {
        const pits = pitStats.pitsByDriver[driverNum].filter(p => p.pit_duration && p.pit_duration > 0);
        if (pits.length > 0) {
          driverAvgTimes[driverNum] = pits.reduce((sum, pit) => sum + pit.pit_duration, 0) / pits.length;
        }
      });

      const sortedDrivers = Object.keys(driverAvgTimes)
        .sort((a, b) => driverAvgTimes[a] - driverAvgTimes[b])
        .slice(0, 10);

      if (sortedDrivers.length === 0) {
        return null;
      }

      return {
        labels: sortedDrivers.map(driverNum => {
          const driver = sessionData.drivers.find(d => d.driver_number == driverNum);
          return driver?.name_acronym || `#${driverNum}`;
        }),
        datasets: [{
          label: 'Average Pit Stop Duration',
          data: sortedDrivers.map(driverNum => driverAvgTimes[driverNum]),
          backgroundColor: sortedDrivers.map((driverNum, index) => {
            const driver = sessionData.drivers.find(d => d.driver_number == driverNum);
            return driverColors[driver?.name_acronym] || `hsl(${index * 40}, 70%, 50%)`;
          }),
          borderColor: sortedDrivers.map((driverNum, index) => {
            const driver = sessionData.drivers.find(d => d.driver_number == driverNum);
            return driverColors[driver?.name_acronym] || `hsl(${index * 40}, 70%, 50%)`;
          }),
          borderWidth: 2
        }]
      };
    } catch (err) {
      console.error('Error creating pit duration chart:', err);
      return null;
    }
  }, [sessionData, pitStats]);
};

const PitStrategyPage = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  
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

  const scatterData = usePitScatterData(sessionData);
  const durationData = usePitDurationData(sessionData, pitStats);

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

  // Chart options
  const scatterOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: { color: 'white' }
      },
      title: {
        display: true,
        text: 'Pit Stop Timing Throughout Race',
        color: 'white'
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: 'white',
        bodyColor: 'white',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        callbacks: {
          label: (context) => {
            const driver = context.dataset.label;
            const lap = context.parsed.x;
            const duration = context.parsed.y;
            return `${driver}: Lap ${lap}, ${formatTime(duration)}`;
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
        title: { display: true, text: 'Pit Duration (seconds)', color: 'white' },
        ticks: {
          color: 'white',
          callback: (value) => formatTime(value)
        },
        grid: { color: 'rgba(255, 255, 255, 0.1)' }
      }
    }
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: {
        display: true,
        text: 'Average Pit Stop Duration by Driver',
        color: 'white'
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
        ticks: { color: 'white' },
        grid: { color: 'rgba(255, 255, 255, 0.1)' }
      },
      y: {
        ticks: {
          color: 'white',
          callback: (value) => formatTime(value)
        },
        grid: { color: 'rgba(255, 255, 255, 0.1)' }
      }
    }
  };

  // Show initial loading screen
  if (initialLoading) {
    return (
      <F1PageLayout 
        title="⛽ Pit Stop Strategy Analysis"
        showHeader={true}
      >
        <DataLoader 
          message="Loading F1 Sessions..." 
          submessage="Fetching race and sprint sessions from OpenF1 API"
        />
      </F1PageLayout>
    );
  }

  // Stats data for grid
  const statsData = Object.keys(pitStats).length > 0 ? [
    {
      label: 'Total Pit Stops',
      value: pitStats.totalPitStops.toString(),
      sublabel: 'in session',
      color: 'blue'
    },
    {
      label: 'Average Duration',
      value: formatTime(pitStats.averagePitTime),
      sublabel: 'pit stop time',
      color: 'green'
    },
    {
      label: 'Fastest Stop',
      value: pitStats.fastestPitStop ? formatTime(pitStats.fastestPitStop.pit_duration) : '--:--',
      sublabel: pitStats.fastestPitStop ? 
        sessionData.drivers?.find(d => d.driver_number == pitStats.fastestPitStop.driver_number)?.name_acronym || `#${pitStats.fastestPitStop.driver_number}`
        : 'N/A',
      color: 'yellow'
    },
    {
      label: 'Slowest Stop',
      value: pitStats.slowestPitStop ? formatTime(pitStats.slowestPitStop.pit_duration) : '--:--',
      sublabel: pitStats.slowestPitStop ? 
        sessionData.drivers?.find(d => d.driver_number == pitStats.slowestPitStop.driver_number)?.name_acronym || `#${pitStats.slowestPitStop.driver_number}`
        : 'N/A',
      color: 'red'
    }
  ] : [];

  return (
    <F1PageLayout 
      title="⛽ Pit Stop Strategy Analysis"
      subtitle="Analyze pit stop timing, duration, and strategic decisions"
      className="pit-strategy-page"
    >
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

      {/* Statistics Cards */}
      {statsData.length > 0 && (
        <StatsGrid stats={statsData} className="pit-stats" />
      )}

      {/* Charts Grid */}
      {loading ? (
        <div>
          <ChartLoadingSkeleton isMobile={isMobile} />
          <ChartLoadingSkeleton isMobile={isMobile} />
        </div>
      ) : (scatterData || durationData) ? (
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(500px, 1fr))',
          gap: '2rem',
          marginBottom: '2rem'
        }}>
          {/* Pit Stop Timeline */}
          {scatterData && (
            <div style={{
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '8px',
              padding: '1rem',
              height: '400px'
            }}>
              <Scatter data={scatterData} options={scatterOptions} />
            </div>
          )}

          {/* Average Duration Comparison */}
          {durationData && (
            <div style={{
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '8px',
              padding: '1rem',
              height: '400px'
            }}>
              <Bar data={durationData} options={barOptions} />
            </div>
          )}
        </div>
      ) : !error && selectedSession && (
        <div className="no-data">
          Select a session to analyze pit stop strategy
        </div>
      )}

      {/* Enhanced Pit Stop Timeline */}
      {sessionData.pits && sessionData.drivers && sessionData.pits.length > 0 && (
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '8px',
          padding: '1.5rem',
          marginTop: '2rem'
        }}>
          <h3 style={{ color: '#fff', marginBottom: '1.5rem', fontSize: '1.1rem' }}>
            📊 Pit Stop Timeline
          </h3>
          <div style={{
            maxHeight: '400px',
            overflowY: 'auto',
            paddingRight: '1rem'
          }}>
            {sessionData.pits
              .filter(pit => pit.lap_number && pit.pit_duration)
              .sort((a, b) => a.lap_number - b.lap_number)
              .map((pit, index) => {
                const driver = sessionData.drivers.find(d => d.driver_number == pit.driver_number);
                const driverName = driver?.name_acronym || `#${pit.driver_number}`;
                
                return (
                  <div key={index} style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0.75rem',
                    marginBottom: '0.5rem',
                    backgroundColor: index % 2 === 0 ? 'rgba(255, 255, 255, 0.02)' : 'transparent',
                    borderRadius: '6px',
                    transition: 'background-color 0.2s ease'
                  }}>
                    <div style={{
                      minWidth: '60px',
                      fontWeight: 'bold',
                      color: '#888'
                    }}>
                      Lap {pit.lap_number}
                    </div>
                    <div style={{
                      flex: 1,
                      marginLeft: '1rem',
                      fontWeight: 'bold',
                      color: '#fff'
                    }}>
                      {driverName}
                    </div>
                    <div style={{
                      fontWeight: 'bold',
                      color: pit.pit_duration < 2.5 ? '#10B981' : 
                             pit.pit_duration < 3.0 ? '#F59E0B' : '#EF4444'
                    }}>
                      {formatTime(pit.pit_duration)}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* No data message */}
      {sessionData.pits && sessionData.pits.length === 0 && !loading && !error && (
        <div className="no-data">
          No pit stop data available for this session
        </div>
      )}
    </F1PageLayout>
  );
};

export default PitStrategyPage;