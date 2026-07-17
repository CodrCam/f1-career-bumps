import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, PointElement, LineElement } from 'chart.js';
import { Bar, Scatter, Line } from 'react-chartjs-2';
import '../components/Analysis.css';
import { F1PageLayout, ResponsiveChart, StatsGrid } from '../components/ChartComponents.jsx';
import { SessionSelector, DriverToggleButtons, ControlBar, ToggleSwitch } from '../components/UIControls.jsx';
import { DataLoader, ErrorMessage, ChartLoadingSkeleton } from '../components/LoadingStates';
import { getSeasonFromParam } from '../utils/seasons.js';
import {
  getSessionDriverColor,
  normalizeDriverTeamFields,
  withColorAlpha,
} from '../utils/dataProcessing.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, PointElement, LineElement);

// Custom hook for enhanced sector analysis data
const useSectorAnalysis = (year) => {
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState('');
  const [sessionData, setSessionData] = useState({});
  const [selectedDrivers, setSelectedDrivers] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sectorStats, setSectorStats] = useState({});
  const [initialLoading, setInitialLoading] = useState(true);

  const apiBase = 'https://api.openf1.org/v1';

  const loadSessions = async () => {
    try {
      setInitialLoading(true);
      setError('');
      
      const response = await fetch(`${apiBase}/sessions?year=${year}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      const now = Date.now();
      const raceSessions = data
        .filter(s => 
          s.session_name === 'Race' || 
          s.session_name === 'Qualifying' ||
          s.session_name === 'Sprint'
        )
        .filter((session) => {
          const sessionEnd = new Date(session.date_end || session.date_start).getTime();
          return Number.isFinite(sessionEnd) && sessionEnd <= now;
        })
        .sort((a, b) => new Date(b.date_start).getTime() - new Date(a.date_start).getTime());
      
      if (raceSessions.length === 0) {
        throw new Error(`No race sessions found for ${year}`);
      }
      
      setSelectedSession('');
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
      const drivers = normalizeDriverTeamFields(await driversResponse.json(), year);

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
      calculateEnhancedSectorStats(laps, drivers);
    } catch (err) {
      console.error('Failed to load session data:', err);
      setError(`Failed to load session data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const calculateEnhancedSectorStats = (laps, drivers) => {
    try {
      const stats = {
        bestSectorTimes: { s1: null, s2: null, s3: null },
        sessionAverages: { s1: 0, s2: 0, s3: 0 },
        driverStats: {},
        sectorLeaders: { s1: null, s2: null, s3: null },
        totalLapsAnalyzed: 0
      };

      // Filter valid laps with sector times
      const validLaps = laps.filter(lap => 
        lap.duration_sector_1 && lap.duration_sector_2 && lap.duration_sector_3 &&
        lap.duration_sector_1 > 0 && lap.duration_sector_2 > 0 && lap.duration_sector_3 > 0
      );

      if (validLaps.length === 0) {
        setSectorStats(stats);
        return;
      }

      stats.totalLapsAnalyzed = validLaps.length;

      // Calculate global best times and session averages
      const s1Times = validLaps.map(lap => lap.duration_sector_1);
      const s2Times = validLaps.map(lap => lap.duration_sector_2);
      const s3Times = validLaps.map(lap => lap.duration_sector_3);

      stats.bestSectorTimes.s1 = Math.min(...s1Times);
      stats.bestSectorTimes.s2 = Math.min(...s2Times);
      stats.bestSectorTimes.s3 = Math.min(...s3Times);

      stats.sessionAverages.s1 = s1Times.reduce((sum, time) => sum + time, 0) / s1Times.length;
      stats.sessionAverages.s2 = s2Times.reduce((sum, time) => sum + time, 0) / s2Times.length;
      stats.sessionAverages.s3 = s3Times.reduce((sum, time) => sum + time, 0) / s3Times.length;

      // Find sector leaders
      const s1Leader = validLaps.find(lap => lap.duration_sector_1 === stats.bestSectorTimes.s1);
      const s2Leader = validLaps.find(lap => lap.duration_sector_2 === stats.bestSectorTimes.s2);
      const s3Leader = validLaps.find(lap => lap.duration_sector_3 === stats.bestSectorTimes.s3);

      stats.sectorLeaders.s1 = s1Leader ? drivers.find(d => d.driver_number == s1Leader.driver_number)?.name_acronym : null;
      stats.sectorLeaders.s2 = s2Leader ? drivers.find(d => d.driver_number == s2Leader.driver_number)?.name_acronym : null;
      stats.sectorLeaders.s3 = s3Leader ? drivers.find(d => d.driver_number == s3Leader.driver_number)?.name_acronym : null;

      // Calculate detailed driver statistics
      validLaps.forEach(lap => {
        const driverNum = lap.driver_number;
        if (!stats.driverStats[driverNum]) {
          stats.driverStats[driverNum] = {
            s1Times: [],
            s2Times: [],
            s3Times: [],
            bestS1: null,
            bestS2: null,
            bestS3: null,
            avgS1: 0,
            avgS2: 0,
            avgS3: 0,
            consistencyS1: 0,
            consistencyS2: 0,
            consistencyS3: 0,
            gapToBestS1: 0,
            gapToBestS2: 0,
            gapToBestS3: 0,
            relativeToAvgS1: 0,
            relativeToAvgS2: 0,
            relativeToAvgS3: 0,
            overallBestLap: null,
            sectorStrengths: {},
            lapCount: 0
          };
        }

        const driverStat = stats.driverStats[driverNum];
        driverStat.s1Times.push(lap.duration_sector_1);
        driverStat.s2Times.push(lap.duration_sector_2);
        driverStat.s3Times.push(lap.duration_sector_3);
        driverStat.lapCount++;
      });

      // Calculate advanced metrics for each driver
      Object.keys(stats.driverStats).forEach(driverNum => {
        const driverStat = stats.driverStats[driverNum];
        
        // Best times
        driverStat.bestS1 = Math.min(...driverStat.s1Times);
        driverStat.bestS2 = Math.min(...driverStat.s2Times);
        driverStat.bestS3 = Math.min(...driverStat.s3Times);

        // Averages
        driverStat.avgS1 = driverStat.s1Times.reduce((sum, time) => sum + time, 0) / driverStat.s1Times.length;
        driverStat.avgS2 = driverStat.s2Times.reduce((sum, time) => sum + time, 0) / driverStat.s2Times.length;
        driverStat.avgS3 = driverStat.s3Times.reduce((sum, time) => sum + time, 0) / driverStat.s3Times.length;

        // Consistency (standard deviation)
        const varianceS1 = driverStat.s1Times.reduce((sum, time) => sum + Math.pow(time - driverStat.avgS1, 2), 0) / driverStat.s1Times.length;
        const varianceS2 = driverStat.s2Times.reduce((sum, time) => sum + Math.pow(time - driverStat.avgS2, 2), 0) / driverStat.s2Times.length;
        const varianceS3 = driverStat.s3Times.reduce((sum, time) => sum + Math.pow(time - driverStat.avgS3, 2), 0) / driverStat.s3Times.length;

        driverStat.consistencyS1 = Math.sqrt(varianceS1);
        driverStat.consistencyS2 = Math.sqrt(varianceS2);
        driverStat.consistencyS3 = Math.sqrt(varianceS3);

        // Gap analysis
        driverStat.gapToBestS1 = driverStat.bestS1 - stats.bestSectorTimes.s1;
        driverStat.gapToBestS2 = driverStat.bestS2 - stats.bestSectorTimes.s2;
        driverStat.gapToBestS3 = driverStat.bestS3 - stats.bestSectorTimes.s3;

        // Relative performance to session average
        driverStat.relativeToAvgS1 = ((driverStat.avgS1 - stats.sessionAverages.s1) / stats.sessionAverages.s1) * 100;
        driverStat.relativeToAvgS2 = ((driverStat.avgS2 - stats.sessionAverages.s2) / stats.sessionAverages.s2) * 100;
        driverStat.relativeToAvgS3 = ((driverStat.avgS3 - stats.sessionAverages.s3) / stats.sessionAverages.s3) * 100;

        // Sector strengths analysis
        const gaps = [driverStat.gapToBestS1, driverStat.gapToBestS2, driverStat.gapToBestS3];
        const minGap = Math.min(...gaps);
        const maxGap = Math.max(...gaps);
        
        driverStat.sectorStrengths = {
          strongest: gaps.indexOf(minGap) + 1, // 1, 2, or 3
          weakest: gaps.indexOf(maxGap) + 1,
          strengthGap: minGap,
          weaknessGap: maxGap,
          consistency: Math.max(...[driverStat.consistencyS1, driverStat.consistencyS2, driverStat.consistencyS3])
        };
      });

      setSectorStats(stats);
    } catch (err) {
      console.error('Error calculating enhanced sector stats:', err);
      setSectorStats({
        bestSectorTimes: { s1: null, s2: null, s3: null },
        sessionAverages: { s1: 0, s2: 0, s3: 0 },
        driverStats: {},
        sectorLeaders: { s1: null, s2: null, s3: null },
        totalLapsAnalyzed: 0
      });
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
    sectorStats,
    initialLoading,
    loadSessions,
    loadSessionData
  };
};

// Enhanced relative performance chart for sectors
const useRelativeSectorData = (sessionData, sectorStats, selectedDrivers) => {
  return React.useMemo(() => {
    if (!sessionData.drivers || Object.keys(sectorStats.driverStats || {}).length === 0) {
      return null;
    }

    try {
      const driversWithData = Object.keys(sectorStats.driverStats)
        .filter(driverNum => sectorStats.driverStats[driverNum].lapCount > 0);

      if (driversWithData.length === 0) return null;

      // Filter by selected drivers if any are selected
      const driversToShow = selectedDrivers.size > 0 
        ? driversWithData.filter(driverNum => {
            const driver = sessionData.drivers.find(d => d.driver_number == driverNum);
            return selectedDrivers.has(driverNum) || selectedDrivers.has(driver?.name_acronym);
          })
        : driversWithData;

      if (driversToShow.length === 0) return null;

      // Sort by overall performance (average gap across all sectors)
      driversToShow.sort((a, b) => {
        const avgGapA = (sectorStats.driverStats[a].gapToBestS1 + sectorStats.driverStats[a].gapToBestS2 + sectorStats.driverStats[a].gapToBestS3) / 3;
        const avgGapB = (sectorStats.driverStats[b].gapToBestS1 + sectorStats.driverStats[b].gapToBestS2 + sectorStats.driverStats[b].gapToBestS3) / 3;
        return avgGapA - avgGapB;
      });

      return {
        labels: driversToShow.map(driverNum => {
          const driver = sessionData.drivers.find(d => d.driver_number == driverNum);
          return driver?.name_acronym || `#${driverNum}`;
        }),
        datasets: [
          {
            label: 'Sector 1 vs Session Avg (%)',
            data: driversToShow.map(driverNum => sectorStats.driverStats[driverNum].relativeToAvgS1),
            backgroundColor: driversToShow.map((driverNum, index) => {
              const driver = sessionData.drivers.find(d => d.driver_number == driverNum);
              const relativePerf = sectorStats.driverStats[driverNum].relativeToAvgS1;
              const baseColor = getSessionDriverColor(driver, index);
              const opacity = relativePerf < -1 ? '90' : relativePerf < 0 ? '70' : relativePerf < 1 ? '50' : '30';
              return withColorAlpha(baseColor, opacity);
            }),
            borderColor: driversToShow.map((driverNum, index) => {
              const driver = sessionData.drivers.find(d => d.driver_number == driverNum);
              return getSessionDriverColor(driver, index);
            }),
            borderWidth: 2
          },
          {
            label: 'Sector 2 vs Session Avg (%)',
            data: driversToShow.map(driverNum => sectorStats.driverStats[driverNum].relativeToAvgS2),
            backgroundColor: driversToShow.map((driverNum, index) => {
              const driver = sessionData.drivers.find(d => d.driver_number == driverNum);
              const relativePerf = sectorStats.driverStats[driverNum].relativeToAvgS2;
              const baseColor = getSessionDriverColor(driver, index);
              const opacity = relativePerf < -1 ? '90' : relativePerf < 0 ? '70' : relativePerf < 1 ? '50' : '30';
              return withColorAlpha(baseColor, opacity);
            }),
            borderColor: driversToShow.map((driverNum, index) => {
              const driver = sessionData.drivers.find(d => d.driver_number == driverNum);
              return getSessionDriverColor(driver, index);
            }),
            borderWidth: 2
          },
          {
            label: 'Sector 3 vs Session Avg (%)',
            data: driversToShow.map(driverNum => sectorStats.driverStats[driverNum].relativeToAvgS3),
            backgroundColor: driversToShow.map((driverNum, index) => {
              const driver = sessionData.drivers.find(d => d.driver_number == driverNum);
              const relativePerf = sectorStats.driverStats[driverNum].relativeToAvgS3;
              const baseColor = getSessionDriverColor(driver, index);
              const opacity = relativePerf < -1 ? '90' : relativePerf < 0 ? '70' : relativePerf < 1 ? '50' : '30';
              return withColorAlpha(baseColor, opacity);
            }),
            borderColor: driversToShow.map((driverNum, index) => {
              const driver = sessionData.drivers.find(d => d.driver_number == driverNum);
              return getSessionDriverColor(driver, index);
            }),
            borderWidth: 2
          }
        ]
      };
    } catch (err) {
      console.error('Error creating relative sector data:', err);
      return null;
    }
  }, [sessionData, sectorStats, selectedDrivers]);
};

// Precision gap analysis chart
const usePrecisionGapData = (sessionData, sectorStats, selectedDrivers) => {
  return React.useMemo(() => {
    if (!sessionData.drivers || Object.keys(sectorStats.driverStats || {}).length === 0) {
      return null;
    }

    try {
      const driversWithData = Object.keys(sectorStats.driverStats)
        .filter(driverNum => sectorStats.driverStats[driverNum].lapCount > 0);

      if (driversWithData.length === 0) return null;

      // Filter by selected drivers if any are selected
      const driversToShow = selectedDrivers.size > 0 
        ? driversWithData.filter(driverNum => {
            const driver = sessionData.drivers.find(d => d.driver_number == driverNum);
            return selectedDrivers.has(driverNum) || selectedDrivers.has(driver?.name_acronym);
          })
        : driversWithData;

      if (driversToShow.length === 0) return null;

      // Sort by overall performance
      driversToShow.sort((a, b) => {
        const avgGapA = (sectorStats.driverStats[a].gapToBestS1 + sectorStats.driverStats[a].gapToBestS2 + sectorStats.driverStats[a].gapToBestS3) / 3;
        const avgGapB = (sectorStats.driverStats[b].gapToBestS1 + sectorStats.driverStats[b].gapToBestS2 + sectorStats.driverStats[b].gapToBestS3) / 3;
        return avgGapA - avgGapB;
      });

      return {
        labels: driversToShow.map(driverNum => {
          const driver = sessionData.drivers.find(d => d.driver_number == driverNum);
          return driver?.name_acronym || `#${driverNum}`;
        }),
        datasets: [
          {
            label: 'Sector 1 Gap to Best (ms)',
            data: driversToShow.map(driverNum => (sectorStats.driverStats[driverNum].gapToBestS1 * 1000).toFixed(0)),
            backgroundColor: 'rgba(239, 68, 68, 0.7)',
            borderColor: 'rgba(239, 68, 68, 1)',
            borderWidth: 2
          },
          {
            label: 'Sector 2 Gap to Best (ms)',
            data: driversToShow.map(driverNum => (sectorStats.driverStats[driverNum].gapToBestS2 * 1000).toFixed(0)),
            backgroundColor: 'rgba(245, 158, 11, 0.7)',
            borderColor: 'rgba(245, 158, 11, 1)',
            borderWidth: 2
          },
          {
            label: 'Sector 3 Gap to Best (ms)',
            data: driversToShow.map(driverNum => (sectorStats.driverStats[driverNum].gapToBestS3 * 1000).toFixed(0)),
            backgroundColor: 'rgba(34, 197, 94, 0.7)',
            borderColor: 'rgba(34, 197, 94, 1)',
            borderWidth: 2
          }
        ]
      };
    } catch (err) {
      console.error('Error creating precision gap data:', err);
      return null;
    }
  }, [sessionData, sectorStats, selectedDrivers]);
};

// Sector strengths analysis
const useSectorStrengthData = (sessionData, sectorStats) => {
  return React.useMemo(() => {
    if (!sessionData.drivers || Object.keys(sectorStats.driverStats || {}).length === 0) {
      return null;
    }

    try {
      const driversWithData = Object.keys(sectorStats.driverStats)
        .filter(driverNum => sectorStats.driverStats[driverNum].lapCount > 0);

      if (driversWithData.length === 0) return null;

      return {
        datasets: driversWithData.map((driverNum, index) => {
          const driverStat = sectorStats.driverStats[driverNum];
          const driver = sessionData.drivers.find(d => d.driver_number == driverNum);
          const driverName = driver?.name_acronym || `#${driverNum}`;

          return {
            label: driverName,
            data: [
              {
                x: driverStat.gapToBestS1 * 1000, // Convert to ms
                y: driverStat.consistencyS1 * 1000,
                sector: 'S1',
                gap: driverStat.gapToBestS1,
                consistency: driverStat.consistencyS1
              },
              {
                x: driverStat.gapToBestS2 * 1000,
                y: driverStat.consistencyS2 * 1000,
                sector: 'S2',
                gap: driverStat.gapToBestS2,
                consistency: driverStat.consistencyS2
              },
              {
                x: driverStat.gapToBestS3 * 1000,
                y: driverStat.consistencyS3 * 1000,
                sector: 'S3',
                gap: driverStat.gapToBestS3,
                consistency: driverStat.consistencyS3
              }
            ],
            backgroundColor: `hsl(${index * 15}, 70%, 50%)`,
            borderColor: `hsl(${index * 15}, 70%, 50%)`,
            pointRadius: 8,
            pointHoverRadius: 12,
            showLine: false
          };
        }).slice(0, 12) // Limit for readability
      };
    } catch (err) {
      console.error('Error creating sector strength data:', err);
      return null;
    }
  }, [sessionData, sectorStats]);
};

const SectorAnalysisPage = () => {
  const { seasonYear } = useParams();
  const selectedYear = getSeasonFromParam(seasonYear);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [visualizationType, setVisualizationType] = useState('relative'); // 'relative', 'precision', 'strengths'
  const [showConsistency, setShowConsistency] = useState(false);
  
  const {
    sessions,
    selectedSession,
    setSelectedSession,
    sessionData,
    selectedDrivers,
    setSelectedDrivers,
    loading,
    error,
    sectorStats,
    initialLoading,
    loadSessions,
    loadSessionData
  } = useSectorAnalysis(selectedYear);

  const relativeData = useRelativeSectorData(sessionData, sectorStats, selectedDrivers);
  const precisionData = usePrecisionGapData(sessionData, sectorStats, selectedDrivers);
  const strengthData = useSectorStrengthData(sessionData, sectorStats);

  useEffect(() => {
    loadSessions();
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [selectedYear]);

  const formatTime = (seconds) => {
    if (!seconds || seconds === 0) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(3);
    return mins > 0 ? `${mins}:${secs.padStart(6, '0')}` : `${secs}s`;
  };

  const formatDelta = (delta) => {
    if (!delta && delta !== 0) return '--';
    const sign = delta >= 0 ? '+' : '';
    return `${sign}${(delta * 1000).toFixed(0)}ms`;
  };

  const toggleDriver = (driverName) => {
    const newSelected = new Set(selectedDrivers);
    if (newSelected.has(driverName)) {
      newSelected.delete(driverName);
    } else if (newSelected.size < 8) {
      newSelected.add(driverName);
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

  // Chart options for relative performance
  const relativeOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: { color: 'white', font: { size: isMobile ? 10 : 12 } }
      },
      title: {
        display: true,
        text: 'Sector Performance vs Session Average - Qualifying Precision',
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
            const sector = context.dataset.label.includes('Sector 1') ? 'S1' : 
                          context.dataset.label.includes('Sector 2') ? 'S2' : 'S3';
            
            const driverNum = Object.keys(sectorStats.driverStats || {}).find(num => {
              const d = sessionData.drivers?.find(dr => dr.driver_number == num);
              return (d?.name_acronym || `#${num}`) === driver;
            });
            
            if (driverNum && sectorStats.driverStats[driverNum]) {
              const driverData = sectorStats.driverStats[driverNum];
              const bestTime = sector === 'S1' ? driverData.bestS1 : 
                              sector === 'S2' ? driverData.bestS2 : driverData.bestS3;
              const gapToBest = sector === 'S1' ? driverData.gapToBestS1 : 
                               sector === 'S2' ? driverData.gapToBestS2 : driverData.gapToBestS3;
              
              return [
                `${driver} - ${sector}`,
                `Best: ${formatTime(bestTime)}`,
                `vs Session Avg: ${value >= 0 ? '+' : ''}${value.toFixed(2)}%`,
                `Gap to Best: ${formatDelta(gapToBest)}`
              ];
            }
            return `${driver} ${sector}: ${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
          }
        }
      }
    },
    scales: {
      x: {
        ticks: { 
          color: 'white',
          maxRotation: isMobile ? 90 : 45,
          minRotation: isMobile ? 45 : 0
        },
        grid: { color: 'rgba(255, 255, 255, 0.1)' }
      },
      y: {
        title: { 
          display: true, 
          text: 'Performance vs Session Average (%)', 
          color: 'white' 
        },
        ticks: {
          color: 'white',
          callback: (value) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
        },
        grid: { color: 'rgba(255, 255, 255, 0.1)' }
      }
    }
  };

  // Chart options for precision gaps
  const precisionOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: { color: 'white', font: { size: isMobile ? 10 : 12 } }
      },
      title: {
        display: true,
        text: 'Precision Gap Analysis - Every Millisecond Counts',
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
          maxRotation: isMobile ? 90 : 45,
          minRotation: isMobile ? 45 : 0
        },
        grid: { color: 'rgba(255, 255, 255, 0.1)' }
      },
      y: {
        title: { 
          display: true, 
          text: 'Gap to Fastest Sector (milliseconds)', 
          color: 'white' 
        },
        ticks: {
          color: 'white',
          callback: (value) => `+${value}ms`
        },
        grid: { color: 'rgba(255, 255, 255, 0.1)' },
        beginAtZero: true
      }
    }
  };

  // Chart options for sector strengths scatter
  const strengthOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: { color: 'white', font: { size: isMobile ? 8 : 10 } }
      },
      title: {
        display: true,
        text: 'Speed vs Consistency by Sector',
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
            const point = context.raw;
            const driver = context.dataset.label;
            return [
              `${driver} - ${point.sector}`,
              `Gap to Best: ${formatDelta(point.gap)}`,
              `Consistency: ±${(point.consistency * 1000).toFixed(0)}ms`
            ];
          }
        }
      }
    },
    scales: {
      x: {
        title: { display: true, text: 'Gap to Fastest (milliseconds)', color: 'white' },
        ticks: { color: 'white' },
        grid: { color: 'rgba(255, 255, 255, 0.1)' }
      },
      y: {
        title: { display: true, text: 'Consistency (milliseconds)', color: 'white' },
        ticks: { color: 'white' },
        grid: { color: 'rgba(255, 255, 255, 0.1)' }
      }
    }
  };

  // Show initial loading screen
  if (initialLoading) {
    return (
      <F1PageLayout 
        title="Sector Time Analysis"
        showHeader={true}
      >
        <DataLoader 
          message="Loading F1 Sessions..." 
          submessage={`Fetching ${selectedYear} race sessions`}
        />
      </F1PageLayout>
    );
  }

  // Enhanced stats data
  const statsData = sectorStats.bestSectorTimes?.s1 ? [
    {
      label: 'Sector 1 Best',
      value: formatTime(sectorStats.bestSectorTimes.s1),
      sublabel: sectorStats.sectorLeaders?.s1 || 'N/A',
      color: 'red'
    },
    {
      label: 'Sector 2 Best',
      value: formatTime(sectorStats.bestSectorTimes.s2),
      sublabel: sectorStats.sectorLeaders?.s2 || 'N/A',
      color: 'yellow'
    },
    {
      label: 'Sector 3 Best',
      value: formatTime(sectorStats.bestSectorTimes.s3),
      sublabel: sectorStats.sectorLeaders?.s3 || 'N/A',
      color: 'green'
    },
    {
      label: 'Laps Analyzed',
      value: sectorStats.totalLapsAnalyzed.toString(),
      sublabel: 'valid sector data',
      color: 'blue'
    }
  ] : [];

  return (
    <F1PageLayout 
      title="Sector Time Analysis"
      subtitle={`${selectedYear} sector pace, consistency, and session-relative performance`}
      className="enhanced-sector-analysis-page"
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
          <option value="precision">Precision Gaps</option>
          <option value="strengths">Sector Strengths</option>
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
          selectedDrivers={selectedDrivers}
          onToggleDriver={toggleDriver}
          maxDrivers={8}
          title="Select Drivers to Compare"
        />
      )}

      {/* Enhanced Statistics Cards */}
      {statsData.length > 0 && (
        <StatsGrid stats={statsData} className="enhanced-sector-stats" />
      )}

      {/* Main Visualization */}
      {loading ? (
        <ChartLoadingSkeleton isMobile={isMobile} />
      ) : (
        <div style={{ marginBottom: '2rem' }}>
          {visualizationType === 'relative' && relativeData && (
            <div style={{
              backgroundColor: 'rgba(17, 20, 25, 0.98)',
              borderRadius: '8px',
              padding: '1rem',
              height: isMobile ? '600px' : '700px'
            }}>
              <Bar data={relativeData} options={relativeOptions} />
            </div>
          )}

          {visualizationType === 'precision' && precisionData && (
            <div style={{
              backgroundColor: 'rgba(17, 20, 25, 0.98)',
              borderRadius: '8px',
              padding: '1rem',
              height: isMobile ? '600px' : '700px'
            }}>
              <Bar data={precisionData} options={precisionOptions} />
            </div>
          )}

          {visualizationType === 'strengths' && strengthData && (
            <div style={{
              backgroundColor: 'rgba(17, 20, 25, 0.98)',
              borderRadius: '8px',
              padding: '1rem',
              height: isMobile ? '600px' : '700px'
            }}>
              <Scatter data={strengthData} options={strengthOptions} />
            </div>
          )}
        </div>
      )}

      {/* Sector Performance Table */}
      {Object.keys(sectorStats.driverStats || {}).length > 0 && (
        <div style={{
          backgroundColor: 'rgba(17, 20, 25, 0.98)',
          borderRadius: '8px',
          padding: '1.5rem',
          marginTop: '2rem'
        }}>
          <h3 style={{ color: '#fff', marginBottom: '1.5rem', fontSize: '1.1rem' }}>
            🎯 Sector Performance Breakdown
          </h3>
          
          {isMobile ? (
            /* Mobile Card Layout */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {Object.keys(sectorStats.driverStats)
                .filter(driverNum => sectorStats.driverStats[driverNum].lapCount > 0)
                .sort((a, b) => {
                  const avgGapA = (sectorStats.driverStats[a].gapToBestS1 + sectorStats.driverStats[a].gapToBestS2 + sectorStats.driverStats[a].gapToBestS3) / 3;
                  const avgGapB = (sectorStats.driverStats[b].gapToBestS1 + sectorStats.driverStats[b].gapToBestS2 + sectorStats.driverStats[b].gapToBestS3) / 3;
                  return avgGapA - avgGapB;
                })
                .map((driverNum, index) => {
                  const driverData = sectorStats.driverStats[driverNum];
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
                            {driverData.lapCount} laps analyzed
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#10B981' }}>
                            S{driverData.sectorStrengths.strongest} Strongest
                          </div>
                          <div style={{ fontSize: '0.8rem', color: '#EF4444' }}>
                            S{driverData.sectorStrengths.weakest} Weakest
                          </div>
                        </div>
                      </div>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', fontSize: '0.8rem' }}>
                        <div style={{ textAlign: 'center' }}>
                          <span style={{ color: '#EF4444', fontWeight: 'bold' }}>S1</span>
                          <div style={{ color: '#fff', fontWeight: 'bold' }}>{formatTime(driverData.bestS1)}</div>
                          <div style={{ color: '#aaa' }}>{formatDelta(driverData.gapToBestS1)}</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <span style={{ color: '#F59E0B', fontWeight: 'bold' }}>S2</span>
                          <div style={{ color: '#fff', fontWeight: 'bold' }}>{formatTime(driverData.bestS2)}</div>
                          <div style={{ color: '#aaa' }}>{formatDelta(driverData.gapToBestS2)}</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <span style={{ color: '#10B981', fontWeight: 'bold' }}>S3</span>
                          <div style={{ color: '#fff', fontWeight: 'bold' }}>{formatTime(driverData.bestS3)}</div>
                          <div style={{ color: '#aaa' }}>{formatDelta(driverData.gapToBestS3)}</div>
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
                    <th style={{ padding: '1rem', textAlign: 'center', color: '#EF4444', fontWeight: 'bold' }}>S1 Best</th>
                    <th style={{ padding: '1rem', textAlign: 'center', color: '#F59E0B', fontWeight: 'bold' }}>S2 Best</th>
                    <th style={{ padding: '1rem', textAlign: 'center', color: '#10B981', fontWeight: 'bold' }}>S3 Best</th>
                    <th style={{ padding: '1rem', textAlign: 'center', color: '#fff', fontWeight: 'bold' }}>Strongest</th>
                    <th style={{ padding: '1rem', textAlign: 'center', color: '#fff', fontWeight: 'bold' }}>Laps</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(sectorStats.driverStats)
                    .filter(driverNum => sectorStats.driverStats[driverNum].lapCount > 0)
                    .sort((a, b) => {
                      const avgGapA = (sectorStats.driverStats[a].gapToBestS1 + sectorStats.driverStats[a].gapToBestS2 + sectorStats.driverStats[a].gapToBestS3) / 3;
                      const avgGapB = (sectorStats.driverStats[b].gapToBestS1 + sectorStats.driverStats[b].gapToBestS2 + sectorStats.driverStats[b].gapToBestS3) / 3;
                      return avgGapA - avgGapB;
                    })
                    .map((driverNum, index) => {
                      const driverData = sectorStats.driverStats[driverNum];
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
                          <td style={{ padding: '1rem', textAlign: 'center', color: '#fff' }}>
                            {formatTime(driverData.bestS1)}
                            <div style={{ fontSize: '0.8rem', color: '#aaa' }}>{formatDelta(driverData.gapToBestS1)}</div>
                          </td>
                          <td style={{ padding: '1rem', textAlign: 'center', color: '#fff' }}>
                            {formatTime(driverData.bestS2)}
                            <div style={{ fontSize: '0.8rem', color: '#aaa' }}>{formatDelta(driverData.gapToBestS2)}</div>
                          </td>
                          <td style={{ padding: '1rem', textAlign: 'center', color: '#fff' }}>
                            {formatTime(driverData.bestS3)}
                            <div style={{ fontSize: '0.8rem', color: '#aaa' }}>{formatDelta(driverData.gapToBestS3)}</div>
                          </td>
                          <td style={{ 
                            padding: '1rem', 
                            textAlign: 'center', 
                            color: '#10B981',
                            fontWeight: 'bold'
                          }}>
                            Sector {driverData.sectorStrengths.strongest}
                          </td>
                          <td style={{ padding: '1rem', textAlign: 'center', color: '#ccc' }}>
                            {driverData.lapCount}
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
    </F1PageLayout>
  );
};

export default SectorAnalysisPage;
