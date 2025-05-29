import React, { useState, useEffect } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, PointElement, LineElement } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import '../components/Analysis.css';
import { F1PageLayout, ResponsiveChart, StatsGrid } from '../components/ChartComponents.jsx';
import { SessionSelector, DriverToggleButtons } from '../components/UIControls.jsx';
import { DataLoader, ErrorMessage, ChartLoadingSkeleton } from '../components/LoadingStates';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, PointElement, LineElement);

// Custom hook for sector analysis data
const useSectorAnalysis = () => {
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState('');
  const [sessionData, setSessionData] = useState({});
  const [selectedDrivers, setSelectedDrivers] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [bestSectorTimes, setBestSectorTimes] = useState({ s1: 0, s2: 0, s3: 0 });
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
        s.session_name === 'Race' || 
        s.session_name === 'Qualifying' ||
        s.session_name === 'Sprint'
      ).slice(-20);
      
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
      const [lapsResponse, driversResponse] = await Promise.all([
        fetch(`${apiBase}/laps?session_key=${selectedSession}`),
        fetch(`${apiBase}/drivers?session_key=${selectedSession}`)
      ]);

      if (!lapsResponse.ok) {
        throw new Error(`Failed to fetch lap data: HTTP ${lapsResponse.status}`);
      }
      
      if (!driversResponse.ok) {
        throw new Error(`Failed to fetch driver data: HTTP ${driversResponse.status}`);
      }

      const laps = await lapsResponse.json();
      const drivers = await driversResponse.json();

      if (!Array.isArray(laps) || !Array.isArray(drivers)) {
        throw new Error('Invalid data format received from API');
      }

      if (laps.length === 0) {
        setError('No lap data available for this session');
        return;
      }

      if (drivers.length === 0) {
        setError('No driver data available for this session');
        return;
      }

      setSessionData({ laps, drivers });
      calculateBestSectorTimes(laps);
    } catch (err) {
      console.error('Failed to load session data:', err);
      setError(`Failed to load session data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const calculateBestSectorTimes = (laps) => {
    try {
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
    } catch (err) {
      console.error('Error calculating sector times:', err);
      setBestSectorTimes({ s1: 0, s2: 0, s3: 0 });
    }
  };

  return {
    sessions,
    selectedSession,
    setSelectedSession,
    sessionData,
    selectedDrivers,
    setSelectedDrivers,
    loading,
    error,
    bestSectorTimes,
    initialLoading,
    loadSessions,
    loadSessionData
  };
};

// Component for creating sector chart data
const useSectorChartData = (sessionData, selectedDrivers) => {
  return React.useMemo(() => {
    if (!sessionData.laps || !sessionData.drivers) return null;

    try {
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
    } catch (err) {
      console.error('Error creating chart data:', err);
      return null;
    }
  }, [sessionData, selectedDrivers]);
};

const SectorAnalysisPage = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  
  const {
    sessions,
    selectedSession,
    setSelectedSession,
    sessionData,
    selectedDrivers,
    setSelectedDrivers,
    loading,
    error,
    bestSectorTimes,
    initialLoading,
    loadSessions,
    loadSessionData
  } = useSectorAnalysis();

  const chartData = useSectorChartData(sessionData, selectedDrivers);

  useEffect(() => {
    loadSessions();
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const formatTime = (seconds) => {
    if (!seconds || seconds === 0) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(3);
    return mins > 0 ? `${mins}:${secs.padStart(6, '0')}` : `${secs}s`;
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

  const uniqueDrivers = sessionData.drivers 
    ? [...new Set(sessionData.laps?.map(lap => lap.driver_number) || [])].sort((a, b) => {
        const d1 = sessionData.drivers.find(d => d.driver_number == a)?.name_acronym || '';
        const d2 = sessionData.drivers.find(d => d.driver_number == b)?.name_acronym || '';
        return d1.localeCompare(d2);
      })
    : [];

  const driverColors = uniqueDrivers.reduce((acc, driverNum) => {
    const driver = sessionData.drivers?.find(d => d.driver_number == driverNum);
    acc[driverNum] = driver?.name_acronym || `#${driverNum}`;
    return acc;
  }, {});

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

  // Show initial loading screen
  if (initialLoading) {
    return (
      <F1PageLayout 
        title="🏁 Sector Time Analysis"
        showHeader={true}
      >
        <DataLoader 
          message="Loading F1 Sessions..." 
          submessage="Fetching 2025 race sessions from OpenF1 API"
        />
      </F1PageLayout>
    );
  }

  const statsData = bestSectorTimes.s1 > 0 ? [
    {
      label: 'Sector 1',
      value: formatTime(bestSectorTimes.s1),
      sublabel: 'Best Time',
      color: 'red'
    },
    {
      label: 'Sector 2', 
      value: formatTime(bestSectorTimes.s2),
      sublabel: 'Best Time',
      color: 'yellow'
    },
    {
      label: 'Sector 3',
      value: formatTime(bestSectorTimes.s3), 
      sublabel: 'Best Time',
      color: 'green'
    }
  ] : [];

  return (
    <F1PageLayout 
      title="🏁 Sector Time Analysis"
      subtitle="Analyze sector performance across qualifying and race sessions"
      className="sector-analysis-page"
    >
      {/* Session Controls */}
      <SessionSelector
        sessions={sessions}
        selectedSession={selectedSession}
        onSessionChange={setSelectedSession}
        onLoadData={loadSessionData}
        loading={loading}
        label="Select Session"
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

      {/* Driver Selection */}
      {uniqueDrivers.length > 0 && (
        <DriverToggleButtons
          drivers={uniqueDrivers.map(driverNum => {
            const driver = sessionData.drivers?.find(d => d.driver_number == driverNum);
            return driver?.name_acronym || `#${driverNum}`;
          })}
          selectedDrivers={new Set([...selectedDrivers].map(driverNum => {
            const driver = sessionData.drivers?.find(d => d.driver_number == driverNum);
            return driver?.name_acronym || `#${driverNum}`;
          }))}
          onToggleDriver={(driverName) => {
            const driverNum = uniqueDrivers.find(num => {
              const driver = sessionData.drivers?.find(d => d.driver_number == num);
              return (driver?.name_acronym || `#${num}`) === driverName;
            });
            if (driverNum) toggleDriver(driverNum);
          }}
          maxDrivers={6}
          driverColors={driverColors}
          title="Select Drivers to Compare"
        />
      )}

      {/* Statistics Cards */}
      {statsData.length > 0 && (
        <StatsGrid stats={statsData} className="sector-stats" />
      )}

      {/* Chart or Loading */}
      {loading ? (
        <ChartLoadingSkeleton isMobile={isMobile} />
      ) : chartData ? (
        <ResponsiveChart 
          type="bar" 
          data={chartData} 
          options={chartOptions}
          className="sector-chart fade-in"
          style={{ height: isMobile ? '400px' : '600px' }}
        />
      ) : !error && selectedSession && (
        <div className="no-data">
          Select a session to view sector analysis
        </div>
      )}
    </F1PageLayout>
  );
};

export default SectorAnalysisPage;