// src/utils/dataProcessing.js
import { useMemo } from 'react';

// Centralized team colors - single source of truth
export const TEAM_COLORS = {
  "McLaren": "#FF8700",
  "Red Bull Racing": "#2446D8",
  "Red Bull": "#2446D8",
  "Mercedes": "#00D2BE",
  "Ferrari": "#DC0000",
  "Williams": "#47A7FF",
  "Alpine": "#FF69B4",
  "Aston Martin": "#006F62",
  "Haas": "#E4E8EC",
  "Haas F1 Team": "#E4E8EC",
  "Racing Bulls": "#8DA2FF",
  "Audi": "#929CAA",
  "Cadillac": "#D9AD3A",
  "Kick Sauber": "#00F500",
  "Sauber": "#00F500",
};

const DRIVER_COLOR_VARIATIONS = {
  "Max Verstappen": "#2446D8",
  "Yuki Tsunoda": "#172E91",
  "Isack Hadjar": "#8DA2FF",
  "Liam Lawson": "#B0BCFF",
  "Arvid Lindblad": "#7188F0",
  "Charles Leclerc": "#DC0000",
  "Lewis Hamilton": "#A90000",
  "Lando Norris": "#FF8700",
  "Oscar Piastri": "#D66F00",
  "George Russell": "#00D2BE",
  "Kimi Antonelli": "#00A998",
  "Fernando Alonso": "#007C6C",
  "Lance Stroll": "#005247",
  "Pierre Gasly": "#FF69B4",
  "Franco Colapinto": "#C94D8A",
  "Jack Doohan": "#A83D72",
  "Alexander Albon": "#47A7FF",
  "Carlos Sainz": "#78C2FF",
  "Esteban Ocon": "#E4E8EC",
  "Oliver Bearman": "#B8C0C9",
  "Nico Hulkenberg": "#AEB7C4",
  "Nico Hülkenberg": "#AEB7C4",
  "Gabriel Bortoleto": "#838E9D",
  "Sergio Perez": "#D9AD3A",
  "Sergio Pérez": "#D9AD3A",
  "Valtteri Bottas": "#F0CB72",
};

const AUDI_TEAM_PATTERN = /\b(sauber|kick|stake)\b/i;

export const normalizeTeamName = (teamName, seasonYear) => {
  if (!teamName) return teamName;

  const normalizedYear = Number(seasonYear);
  if (normalizedYear >= 2026 && AUDI_TEAM_PATTERN.test(teamName)) {
    return "Audi";
  }

  return teamName;
};

export const normalizeSeasonTeamNames = (seasonData, seasonYear) => {
  if (!seasonData?.races) return seasonData;

  const resultKeys = [
    "race_results",
    "qualifying_results",
    "sprint_results",
    "sprint_qualifying_results",
  ];

  return {
    ...seasonData,
    races: seasonData.races.map((race) => {
      const normalizedRace = { ...race };

      resultKeys.forEach((key) => {
        if (!Array.isArray(normalizedRace[key])) return;

        normalizedRace[key] = normalizedRace[key].map((result) => ({
          ...result,
          team: normalizeTeamName(result.team, seasonYear),
        }));
      });

      return normalizedRace;
    }),
  };
};

export const normalizeDriverTeamFields = (drivers, seasonYear) => {
  if (!Array.isArray(drivers)) return drivers;

  return drivers.map((driver) => {
    const normalizedTeam = normalizeTeamName(driver.team_name, seasonYear);
    const color = TEAM_COLORS[normalizedTeam]?.replace("#", "");

    return {
      ...driver,
      team_name: normalizedTeam,
      team_colour: color ?? driver.team_colour,
    };
  });
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

export const getDriverColor = (driverName, teamName, seasonYear) => {
  const normalizedTeam = normalizeTeamName(teamName, seasonYear);

  if (normalizedTeam === "Audi") {
    return DRIVER_COLOR_VARIATIONS[driverName] || TEAM_COLORS.Audi;
  }

  if (normalizedTeam === "Kick Sauber" || normalizedTeam === "Sauber") {
    return TEAM_COLORS[normalizedTeam];
  }

  return DRIVER_COLOR_VARIATIONS[driverName]
    || getTeamColor(normalizedTeam);
};

export const getSessionDriverColor = (driver, fallbackIndex = 0) => {
  const teamColor = driver?.team_colour?.replace("#", "");
  return teamColor
    ? `#${teamColor}`
    : `hsl(${(fallbackIndex * 47) % 360}, 72%, 58%)`;
};

export const withColorAlpha = (color, alpha) => (
  /^#[0-9a-f]{6}$/i.test(color) ? `${color}${alpha}` : color
);

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
