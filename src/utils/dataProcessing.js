// src/utils/dataProcessing.js
import { useMemo } from 'react';

// Centralized team colors - single source of truth
export const TEAM_COLORS = {
  "McLaren": "#FF8700",
  "Red Bull Racing": "#1E41FF", 
  "Mercedes": "#00D2BE",
  "Ferrari": "#DC0000",
  "Williams": "#005AFF",
  "Alpine": "#FF69B4",
  "Aston Martin": "#006F62",
  "Haas": "#B6BABD",
  "Racing Bulls": "#2B4562",
  "Kick Sauber": "#00F500",
};

// Driver change configuration with timing
const DRIVER_CHANGES = [
  {
    from: "Jack Doohan",
    to: "Franco Colapinto",
    team: "Alpine",
    fromRound: 7  // Change starts from Round 7 (Imola)
  }
  // Add future driver changes here
];

// Single, reusable driver change processing function
export const processDriverChanges = (races) => {
  return races.map(race => {
    const processedRace = { ...race };
    
    // Process all result types consistently
    ['race_results', 'qualifying_results', 'sprint_results'].forEach(resultType => {
      if (processedRace[resultType]) {
        processedRace[resultType] = processedRace[resultType].map(result => {
          let updatedResult = { ...result };
          
          // Apply driver changes only from the specified round onwards
          DRIVER_CHANGES.forEach(change => {
            if (result.driver === change.from && 
                result.team === change.team && 
                race.round >= change.fromRound) {
              updatedResult.driver = change.to;
            }
          });
          
          return updatedResult;
        });
      }
    });
    
    return processedRace;
  });
};

// Custom hook for processed race data with memoization
export const useProcessedRaceData = (rawRaces) => {
  return useMemo(() => {
    if (!rawRaces || rawRaces.length === 0) return [];
    return processDriverChanges(rawRaces);
  }, [rawRaces]);
};

// Helper to get team color with fallback
export const getTeamColor = (team) => {
  return TEAM_COLORS[team] || "#888888";
};

// Helper to extract all drivers from processed races (includes both original and replacement drivers)
export const getAllDrivers = (processedRaces) => {
  const driversSet = new Set();
  
  processedRaces.forEach(race => {
    race.race_results?.forEach(result => {
      driversSet.add(result.driver);
    });
  });
  
  return Array.from(driversSet).sort();
};

// NEW: Helper to get all drivers including original drivers (for results pages)
export const getAllDriversIncludingOriginals = (rawRaces, processedRaces) => {
  const driversSet = new Set();
  
  // Get drivers from raw data (original drivers like Jack Doohan)
  rawRaces.forEach(race => {
    race.race_results?.forEach(result => {
      driversSet.add(result.driver);
    });
  });
  
  // Get drivers from processed data (replacement drivers like Franco Colapinto)
  processedRaces.forEach(race => {
    race.race_results?.forEach(result => {
      driversSet.add(result.driver);
    });
  });
  
  return Array.from(driversSet).sort();
};