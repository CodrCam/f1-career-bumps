import React, { useState, useEffect } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, BarElement } from 'chart.js';
import { Scatter, Bar } from 'react-chartjs-2';
import { DataLoader, ErrorMessage, ChartLoadingSkeleton } from '../components/LoadingStates';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, BarElement);

const PitStrategyPage = () => {
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState('');
  const [sessionData, setSessionData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pitStats, setPitStats] = useState({});
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [initialLoading, setInitialLoading] = useState(true);

  const apiBase = 'https://api.openf1.org/v1';

  const driverColors = {
    'HAM': '#DC143C', 'LEC': '#DC143C', // Ferrari
    'VER': '#0600EF', 'TSU': '#0600EF', // Red Bull Racing
    'NOR': '#FF8700', 'PIA': '#FF8700', // McLaren
    'RUS': '#00D2BE', 'ANT': '#00D2BE', // Mercedes (Kimi Antonelli)
    'ALO': '#006F62', 'STR': '#006F62', // Aston Martin
    'GAS': '#0090FF', 'COL': '#0090FF', // Alpine (Franco Colapinto)
    'ALB': '#005AFF', 'SAI': '#005AFF', // Williams
    'OCO': '#B6BABD', 'BEA': '#B6BABD', // Haas
    'HAD': '#2B4562', 'LAW': '#2B4562', // Racing Bulls
    'HUL': '#00F500', 'BOR': '#00F500'  // Kick Sauber
  };

  useEffect(() => {
    loadSessions();
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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

      // Validate data format
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

  const formatTime = (seconds) => {
    if (!seconds || seconds === 0) return '--:--';
    return `${seconds.toFixed(3)}s`;
  };

  const createScatterData = () => {
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
  };

  const createPitDurationChart = () => {
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
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
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
        ticks: { color: 'white' },
        grid: { color: 'rgba(255, 255, 255, 0.1)' }
      },
      y: {
        ticks: { color: 'white' },
        grid: { color: 'rgba(255, 255, 255, 0.1)' }
      }
    }
  };

  const scatterOptions = {
    ...chartOptions,
    plugins: {
      ...chartOptions.plugins,
      title: {
        display: true,
        text: 'Pit Stop Timing Throughout Race',
        color: 'white'
      },
      tooltip: {
        ...chartOptions.plugins.tooltip,
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
      ...chartOptions.scales,
      x: {
        ...chartOptions.scales.x,
        title: { display: true, text: 'Lap Number', color: 'white' }
      },
      y: {
        ...chartOptions.scales.y,
        title: { display: true, text: 'Pit Duration (seconds)', color: 'white' },
        ticks: {
          ...chartOptions.scales.y.ticks,
          callback: (value) => formatTime(value)
        }
      }
    }
  };

  const barOptions = {
    ...chartOptions,
    plugins: {
      ...chartOptions.plugins,
      legend: { display: false },
      title: {
        display: true,
        text: 'Average Pit Stop Duration by Driver',
        color: 'white'
      }
    },
    scales: {
      ...chartOptions.scales,
      y: {
        ...chartOptions.scales.y,
        ticks: {
          ...chartOptions.scales.y.ticks,
          callback: (value) => formatTime(value)
        }
      }
    }
  };

  // Show initial loading screen
  if (initialLoading) {
    return (
      <div className="analysis-container">
        <div className="analysis-header">
          <h1 className="analysis-title">⛽ Pit Stop Strategy Analysis</h1>
        </div>
        <DataLoader 
          message="Loading F1 Sessions..." 
          submessage="Fetching race and sprint sessions from OpenF1 API"
        />
      </div>
    );
  }

  return (
    <div className="analysis-container">
      <div className="analysis-header">
        <h1 className="analysis-title">⛽ Pit Stop Strategy Analysis</h1>
        <p className="analysis-subtitle">
          Analyze pit stop timing, duration, and strategic decisions
        </p>
      </div>

      {/* Controls */}
      <div className="analysis-controls">
        <div className="controls-grid">
          <div className="controls-row">
            <select 
              value={selectedSession} 
              onChange={(e) => setSelectedSession(e.target.value)}
              className="analysis-select"
            >
              <option value="">Select Race Session</option>
              {sessions.map(session => (
                <option key={session.session_key} value={session.session_key}>
                  {session.location} - {session.session_name} ({session.date_start?.split('T')[0] || 'TBD'})
                </option>
              ))}
            </select>
            <button 
              onClick={loadSessionData}
              disabled={loading || !selectedSession}
              className="analysis-button"
            >
              {loading ? 'Loading...' : 'Load Data'}
            </button>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <ErrorMessage
          title="Data Loading Error"
          message={error}
          onRetry={selectedSession ? loadSessionData : loadSessions}
        />
      )}

      {/* Statistics Cards */}
      {Object.keys(pitStats).length > 0 && (
        <div className="stats-grid">
          <div className="stat-card blue">
            <h3>Total Pit Stops</h3>
            <div className="stat-value">{pitStats.totalPitStops}</div>
            <div className="stat-label">in session</div>
          </div>
          <div className="stat-card green">
            <h3>Average Duration</h3>
            <div className="stat-value">{formatTime(pitStats.averagePitTime)}</div>
            <div className="stat-label">pit stop time</div>
          </div>
          <div className="stat-card yellow">
            <h3>Fastest Stop</h3>
            <div className="stat-value">
              {pitStats.fastestPitStop ? formatTime(pitStats.fastestPitStop.pit_duration) : '--:--'}
            </div>
            <div className="stat-label">
              {pitStats.fastestPitStop ? 
                sessionData.drivers?.find(d => d.driver_number == pitStats.fastestPitStop.driver_number)?.name_acronym || `#${pitStats.fastestPitStop.driver_number}`
                : 'N/A'
              }
            </div>
          </div>
          <div className="stat-card red">
            <h3>Slowest Stop</h3>
            <div className="stat-value">
              {pitStats.slowestPitStop ? formatTime(pitStats.slowestPitStop.pit_duration) : '--:--'}
            </div>
            <div className="stat-label">
              {pitStats.slowestPitStop ? 
                sessionData.drivers?.find(d => d.driver_number == pitStats.slowestPitStop.driver_number)?.name_acronym || `#${pitStats.slowestPitStop.driver_number}`
                : 'N/A'
              }
            </div>
          </div>
        </div>
      )}

      {/* Charts or Loading */}
      {loading ? (
        <div>
          <ChartLoadingSkeleton isMobile={isMobile} />
          <ChartLoadingSkeleton isMobile={isMobile} />
        </div>
      ) : sessionData.pits && sessionData.drivers ? (
        <div className="charts-grid" style={{ gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(500px, 1fr))' }}>
          {/* Pit Stop Timeline */}
          {createScatterData() && (
            <div className="chart-container fade-in">
              <div className="chart-wrapper">
                <Scatter data={createScatterData()} options={scatterOptions} />
              </div>
            </div>
          )}

          {/* Average Duration Comparison */}
          {createPitDurationChart() && (
            <div className="chart-container fade-in">
              <div className="chart-wrapper">
                <Bar data={createPitDurationChart()} options={barOptions} />
              </div>
            </div>
          )}
        </div>
      ) : !error && selectedSession && (
        <div className="no-data">
          Select a session to analyze pit stop strategy
        </div>
      )}

      {/* Pit Stop Timeline */}
      {sessionData.pits && sessionData.drivers && sessionData.pits.length > 0 && (
        <div className="data-card">
          <h3>Pit Stop Timeline</h3>
          <div className="timeline">
            {sessionData.pits
                .filter(pit => pit.lap_number && pit.pit_duration)
                .sort((a, b) => a.lap_number - b.lap_number)
                .map((pit, index) => {
                const driver = sessionData.drivers.find(d => d.driver_number == pit.driver_number);
                const driverName = driver?.name_acronym || `#${pit.driver_number}`;
                const color = driverColors[driverName] || '#6366f1';
                
                return (
                  <div key={index} className="timeline-item">
                    <div 
                      className="timeline-marker"
                      style={{ backgroundColor: color }}
                    ></div>
                    <div className="timeline-content">
                      <div className="timeline-title">Lap {pit.lap_number}</div>
                      <div className="timeline-description">{driverName}</div>
                    </div>
                    <div className="timeline-time">{formatTime(pit.pit_duration)}</div>
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
    </div>
  );
};

export default PitStrategyPage;