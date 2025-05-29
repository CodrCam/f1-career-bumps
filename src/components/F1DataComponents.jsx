// src/components/F1DataComponents.jsx
import React, { useMemo } from 'react';
import { useProcessedRaceData, getAllDrivers, getTeamColor } from '../utils/dataProcessing.js';

// Hook for building championship data
export const useChampionshipData = (rawRaces, selectedDrivers = [], isMobile = false) => {
  const processedRaces = useProcessedRaceData(rawRaces);
  
  return useMemo(() => {
    if (!processedRaces || processedRaces.length === 0) return null;

    const pointsMap = new Map();
    const raceLabels = [];

    processedRaces.forEach((race, i) => {
      const circuitLabel = race.circuit?.split(" ")[0] ?? `R${race.round}`;
      raceLabels.push(circuitLabel);

      const sprintMap = new Map();
      if (Array.isArray(race.sprint_results)) {
        race.sprint_results.forEach(({ driver, points }) => {
          sprintMap.set(driver, points);
        });
      }

      race.race_results.forEach(({ driver, points }) => {
        const sprintPoints = sprintMap.get(driver) || 0;
        const total = points + sprintPoints;

        if (!pointsMap.has(driver)) {
          pointsMap.set(driver, []);
        }

        const prev = pointsMap.get(driver)[i - 1] || 0;
        pointsMap.get(driver).push(prev + total);
      });

      // Fill missing data
      for (const [driver, arr] of pointsMap.entries()) {
        if (arr.length < raceLabels.length) {
          const last = arr[arr.length - 1] || 0;
          arr.push(last);
        }
      }
    });

    const datasets = Array.from(pointsMap.entries()).map(([driver, points]) => {
      const team = processedRaces.find((r) =>
        r.race_results.some((res) => res.driver === driver)
      )?.race_results.find((res) => res.driver === driver)?.team;

      const isSelected = selectedDrivers.length === 0 || selectedDrivers.includes(driver);

      return {
        label: driver,
        data: points,
        borderColor: isSelected ? getTeamColor(team) : "rgba(200,200,200,0.3)",
        borderWidth: isSelected ? (isMobile ? 2 : 3) : 1,
        pointRadius: isSelected ? (isMobile ? 2 : 3) : 1,
        pointHoverRadius: isSelected ? (isMobile ? 4 : 5) : 2,
        fill: false,
        tension: 0.3,
      };
    });

    return { labels: raceLabels, datasets };
  }, [processedRaces, selectedDrivers, isMobile]);
};

// Hook for building race results data
export const useRaceResultsData = (rawRaces, selectedDrivers = [], isMobile = false) => {
  const processedRaces = useProcessedRaceData(rawRaces);
  
  return useMemo(() => {
    if (!processedRaces || processedRaces.length === 0) return null;

    const standings = new Map();
    const raceRounds = [];

    processedRaces.forEach((round) => {
      const { round: raceRound, race_results } = round;
      raceRounds.push(`R${raceRound}`);

      race_results.forEach(({ driver, position }) => {
        if (!standings.has(driver)) {
          standings.set(driver, []);
        }
        standings.get(driver).push(position);
      });

      for (const [driver, posArr] of standings.entries()) {
        if (posArr.length < raceRounds.length) {
          posArr.push(null);
        }
      }
    });

    const datasets = Array.from(standings.entries()).map(([driver, positions]) => {
      const team = processedRaces.find((r) =>
        r.race_results.some((res) => res.driver === driver)
      )?.race_results.find((res) => res.driver === driver)?.team;

      const isSelected = selectedDrivers.length === 0 || selectedDrivers.includes(driver);

      return {
        label: driver,
        data: positions,
        borderColor: isSelected ? getTeamColor(team) : "rgba(200,200,200,0.3)",
        borderWidth: isSelected ? (isMobile ? 2 : 3) : 1,
        pointRadius: isSelected ? (isMobile ? 2 : 3) : 1,
        pointHoverRadius: isSelected ? (isMobile ? 4 : 5) : 2,
        fill: false,
        tension: 0,
      };
    });

    return { labels: raceRounds, datasets };
  }, [processedRaces, selectedDrivers, isMobile]);
};

// Hook for building constructor championship data
export const useConstructorData = (rawRaces, isMobile = false) => {
  const processedRaces = useProcessedRaceData(rawRaces);
  
  return useMemo(() => {
    if (!processedRaces || processedRaces.length === 0) return { chartData: null, cumulativeMap: new Map() };

    const allConstructors = new Set();
    const pointsHistory = [];

    const raceRounds = processedRaces.map((race) => {
      return race.circuit?.split(" ")[0] || `R${race.round}`;
    });

    processedRaces.forEach((round) => {
      const roundPoints = new Map();
      
      // Add race points
      round.race_results.forEach(({ team, points }) => {
        allConstructors.add(team);
        roundPoints.set(team, (roundPoints.get(team) || 0) + points);
      });
      
      // Add sprint points
      if (round.sprint_results) {
        round.sprint_results.forEach(({ team, points }) => {
          allConstructors.add(team);
          roundPoints.set(team, (roundPoints.get(team) || 0) + points);
        });
      }
      
      pointsHistory.push(roundPoints);
    });

    const teamStandings = new Map();
    const cumulativeMap = new Map();
    const runningTotals = new Map();

    [...allConstructors].forEach((team) => {
      teamStandings.set(team, []);
      cumulativeMap.set(team, []);
    });

    pointsHistory.forEach((roundPoints) => {
      roundPoints.forEach((points, team) => {
        runningTotals.set(team, (runningTotals.get(team) || 0) + points);
      });

      const sorted = [...runningTotals.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([team]) => team);

      [...allConstructors].forEach((team) => {
        const pos = sorted.indexOf(team);
        const totalPts = runningTotals.get(team) || 0;
        teamStandings.get(team).push(pos !== -1 ? pos + 1 : null);
        cumulativeMap.get(team).push(totalPts);
      });
    });

    const datasets = [...teamStandings.entries()].map(([team, positions]) => ({
      label: team,
      data: positions,
      borderColor: getTeamColor(team),
      backgroundColor: getTeamColor(team),
      fill: false,
      tension: 0.3,
      pointRadius: isMobile ? 2 : 3,
      pointHoverRadius: isMobile ? 4 : 6,
      borderWidth: isMobile ? 2 : 3,
    }));

    return {
      chartData: { labels: raceRounds, datasets },
      cumulativeMap
    };
  }, [processedRaces, isMobile]);
};

// Component for driver selection logic
export const useDriverSelection = (allDrivers, maxDrivers = 2) => {
  const [selectedDrivers, setSelectedDrivers] = React.useState([]);

  const handleDriverSelect = (action, value) => {
    if (action === 'reset') {
      setSelectedDrivers([]);
    } else if (action === 'toggle') {
      setSelectedDrivers(prev => {
        if (prev.includes(value)) {
          return prev.filter(d => d !== value);
        } else if (prev.length < maxDrivers) {
          return [...prev, value];
        }
        return prev;
      });
    } else if (typeof action === 'number') {
      // Mobile dropdown selection
      setSelectedDrivers(prev => {
        const newSelection = [...prev];
        newSelection[action] = value;
        return newSelection.filter(Boolean); // Remove empty strings
      });
    }
  };

  return {
    selectedDrivers,
    setSelectedDrivers,
    handleDriverSelect
  };
};

// Helper component for getting all drivers from race data
export const useAllDrivers = (rawRaces) => {
  const processedRaces = useProcessedRaceData(rawRaces);
  
  return useMemo(() => {
    if (!processedRaces || processedRaces.length === 0) return [];
    return getAllDrivers(processedRaces);
  }, [processedRaces]);
};