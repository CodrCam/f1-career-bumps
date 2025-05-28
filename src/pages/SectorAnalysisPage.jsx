import React, { useState, useEffect, useRef } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, PointElement, LineElement } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import '../components/Analysis.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, PointElement, LineElement);

const SectorAnalysisPage = () => {
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState('');
  const [sessionData, setSessionData] = useState({});
  const [selectedDrivers, setSelectedDrivers] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [bestSectorTimes, setBestSectorTimes] = useState({ s1: 0, s2: 0, s3: 0 });
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  const apiBase = 'https://api.openf1.org/v1';

  // Updated with accurate 2025 driver/team colors
  const driverColors = {
    // Ferrari
    'HAM': '#DC0000', 
    'LEC': '#DC0000',
    
    // Red Bull
    'VER': '#1E41FF', 
    'PER': '#1E41FF',
    
    // McLaren
    'NOR': '#FF8700', 
    'PIA': '#FF8700',
    
    // Mercedes
    'RUS': '#00D2BE', 
    'ANT': '#00D2BE',
    
    // Aston Martin
    'ALO': '#006F62', 
    'STR': '#006F62',
    
    // Alpine
    'GAS': '#0090FF', 
    'COL': '#0090FF',
    
    // Williams
    'ALB': '#005AFF', 
    'LAW': '#005AFF',
    
    // Haas
    'OCO': '#B6BABD', 
    'BEA': '#B6BABD',
    
    // Racing Bulls
    'TSU': '#2B4562', 
    'HAD': '#2B4562',
    
    // Kick Sauber
    'BOT': '#00F500',
    'BOR': '#00F500'
  };

  useEffect(() => {
    loadSessions();
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const loadSessions = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${apiBase}/sessions?year=2025`);
      const data = await response.json();
      
      const raceSessions = data.filter(s => 
        s.session_name === 'Race' || 
        s.session_name === 'Qualifying' ||
        s.session_name === 'Sprint'
      ).slice(-20);
      
      setSessions(raceSessions);
      setLoading(false);
    } catch (err) {
      setError('Failed to load sessions: ' + err.message);
      setLoading(false);
    }
  };

  const loadSessionData = async () => {
    if (!selectedSession) {
      setError('Please select a session');
      return;
    }

    setLoading(true);
    try {
      const [lapsResponse, driversResponse] = await Promise.all([
        fetch(`${apiBase}/laps?session_key=${selectedSession}`),
        fetch(`${apiBase}/drivers?session_key=${selectedSession}`)
      ]);

      const laps = await lapsResponse.json();
      const drivers = await driversResponse.json();

      setSessionData({ laps, drivers });
      calculateBestSectorTimes(laps);
      setLoading(false);
    } catch (err) {
      setError('Failed to load session data: ' + err.message);
      setLoading(false);
    }
  };

  const calculateBestSectorTimes = (laps) => {
    const lapsWithSectors = laps.filter(lap => 
      lap.duration_sector_1 && lap.duration_sector_2 && lap.duration_sector_3
    );

    if (lapsWithSectors.length === 0) {
      setBestSectorTimes({ s1: 0, s2: 0, s3: 0 });
      return;
    }

    const bestS1 = Math.min(...lapsWithSectors.map(lap => lap.duration_sector_1));
    const bestS2 = Math.min(...lapsWithSectors.map(lap => lap.duration_sector_2));
    const bestS3 = Math.min(...lapsWithSectors.map(lap => lap.duration_sector_3));

    setBestSectorTimes({ s1: bestS1, s2: bestS2, s3: bestS3 });
  };

  const toggleDriver = (driverNum) => {
    const newSelected = new Set(selectedDrivers);
    if (newSelected.has(driverNum)) {
      newSelected.delete(driverNum);
    } else if (newSelected.size < 6) {
      newSelected.add(driverNum);
    }
    setSelectedDrivers(newSelected);
  };

  const formatTime = (seconds) => {
    if (!seconds || seconds === 0) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(3);
    return mins > 0 ? `${mins}:${secs.padStart(6, '0')}` : `${secs}s`;
  };

  const createChartData = () => {
    if (!sessionData.laps || !sessionData.drivers) return null;

    const driverSectorData = {};
    sessionData.laps.forEach(lap => {
      if (!driverSectorData[lap.driver_number]) {
        driverSectorData[lap.driver_number] = { s1: [], s2: [], s3: [] };
      }
      if (lap.duration_sector_1) driverSectorData[lap.driver_number].s1.push(lap.duration_sector_1);
      if (lap.duration_sector_2) driverSectorData[lap.driver_number].s2.push(lap.duration_sector_2);
      if (lap.duration_sector_3) driverSectorData[lap.driver_number].s3.push(lap.duration_sector_3);
    });

    const driversToShow = selectedDrivers.size > 0 
      ? Array.from(selectedDrivers) 
      : Object.keys(driverSectorData).slice(0, 8);

    const labels = driversToShow.map(d => {
      const driver = sessionData.drivers.find(dr => dr.driver_number == d);
      return driver?.name_acronym || `#${d}`;
    });

    return {
      labels,
      datasets: [
        {
          label: 'Sector 1 (Best)',
          data: driversToShow.map(d => {
            const times = driverSectorData[d]?.s1 || [];
            return times.length ? Math.min(...times) : 0;
          }),
          backgroundColor: 'rgba(239, 68, 68, 0.7)',
          borderColor: 'rgba(239, 68, 68, 1)',
          borderWidth: 2
        },
        {
          label: 'Sector 2 (Best)',
          data: driversToShow.map(d => {
            const times = driverSectorData[d]?.s2 || [];
            return times.length ? Math.min(...times) : 0;
          }),
          backgroundColor: 'rgba(245, 158, 11, 0.7)',
          borderColor: 'rgba(245, 158, 11, 1)',
          borderWidth: 2
        },
        {
          label: 'Sector 3 (Best)',
          data: driversToShow.map(d => {
            const times = driverSectorData[d]?.s3 || [];
            return times.length ? Math.min(...times) : 0;
          }),
          backgroundColor: 'rgba(34, 197, 94, 0.7)',
          borderColor: 'rgba(34, 197, 94, 1)',
          borderWidth: 2
        }
      ]
    };
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: { color: 'white' }
      },
      title: {
        display: true,
        text: 'Best Sector Times Comparison',
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
            const label = context.dataset.label;
            const value = formatTime(context.raw);
            return `${label}: ${value}`;
          }
        }
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

  const uniqueDrivers = sessionData.drivers 
  ? [...new Set(sessionData.laps?.map(lap => lap.driver_number) || [])].sort((a, b) => {
      const d1 = sessionData.drivers.find(d => d.driver_number == a)?.name_acronym || '';
      const d2 = sessionData.drivers.find(d => d.driver_number == b)?.name_acronym || '';
      return d1.localeCompare(d2);
    })
  : [];

  return (
    <div className="analysis-container">
      <div className="analysis-header">
        <h1 className="analysis-title">🏁 Sector Time Analysis</h1>
        <p className="analysis-subtitle">
          Analyze sector performance across qualifying and race sessions
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
              <option value="">Select Session</option>
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

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {/* Driver Selection */}
      {uniqueDrivers.length > 0 && (
        <div className="driver-selection">
          <h3>Select Drivers to Compare (max 6):</h3>
          <div className="driver-buttons">
            {uniqueDrivers.map(driverNum => {
              const driver = sessionData.drivers?.find(d => d.driver_number == driverNum);
              const isSelected = selectedDrivers.has(driverNum);
              return (
                <button
                  key={driverNum}
                  onClick={() => toggleDriver(driverNum)}
                  className={`driver-button ${isSelected ? 'active' : ''} ${selectedDrivers.size >= 6 && !isSelected ? 'disabled' : ''}`}
                  style={isSelected ? {
                    backgroundColor: driverColors[driver?.name_acronym] || '#6366f1',
                    borderColor: driverColors[driver?.name_acronym] || '#6366f1'
                  } : {}}
                  disabled={selectedDrivers.size >= 6 && !isSelected}
                >
                  {driver?.name_acronym || `#${driverNum}`}
                </button>
              );
            })}
          </div>
          {selectedDrivers.size === 0 && (
            <p style={{ color: '#9ca3af', fontSize: '0.875rem', marginTop: '0.5rem' }}>
              No drivers selected - showing top 8 drivers
            </p>
          )}
        </div>
      )}

      {/* Best Sector Times Display */}
      {bestSectorTimes.s1 > 0 && (
        <div className="stats-grid">
          <div className="stat-card red">
            <h3>Sector 1</h3>
            <div className="stat-value">{formatTime(bestSectorTimes.s1)}</div>
            <div className="stat-label">Best Time</div>
          </div>
          <div className="stat-card yellow">
            <h3>Sector 2</h3>
            <div className="stat-value">{formatTime(bestSectorTimes.s2)}</div>
            <div className="stat-label">Best Time</div>
          </div>
          <div className="stat-card green">
            <h3>Sector 3</h3>
            <div className="stat-value">{formatTime(bestSectorTimes.s3)}</div>
            <div className="stat-label">Best Time</div>
          </div>
        </div>
      )}

      {/* Chart */}
      {sessionData.laps && sessionData.drivers && (
        <div className="chart-container fade-in">
          <div className="chart-wrapper">
            <Bar data={createChartData()} options={chartOptions} />
          </div>
        </div>
      )}

      {loading && (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <div className="loading-text">Loading F1 sector data...</div>
        </div>
      )}

      {!loading && !sessionData.laps && (
        <div className="no-data">
          Select a session to view sector analysis
        </div>
      )}
    </div>
  );
};

export default SectorAnalysisPage;