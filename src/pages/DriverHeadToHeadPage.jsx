import React, { useState, useMemo } from "react";
import f1SeasonData from "../data/f1_2025_season.json";

// Driver change processing function - moved outside component
const processDriverChange = (races) => {
  return races.map(race => {
    const processedRace = { ...race };
    
    // Process race results
    if (processedRace.race_results) {
      processedRace.race_results = processedRace.race_results.map(result => {
        if (result.driver === "Jack Doohan" && result.team === "Alpine") {
          return { ...result, driver: "Franco Colapinto" };
        }
        return result;
      });
    }
    
    // Process qualifying results
    if (processedRace.qualifying_results) {
      processedRace.qualifying_results = processedRace.qualifying_results.map(result => {
        if (result.driver === "Jack Doohan" && result.team === "Alpine") {
          return { ...result, driver: "Franco Colapinto" };
        }
        return result;
      });
    }
    
    // Process sprint results
    if (processedRace.sprint_results) {
      processedRace.sprint_results = processedRace.sprint_results.map(result => {
        if (result.driver === "Jack Doohan" && result.team === "Alpine") {
          return { ...result, driver: "Franco Colapinto" };
        }
        return result;
      });
    }
    
    return processedRace;
  });
};

const parseTimeToSeconds = (time) => {
  if (!time || time === "No Time" || time === "DNF" || time === "DNS") return null;
  if (time.includes("lap")) return 9999;
  if (time.includes(":")) {
    const parts = time.replace("+", "").replace("s", "").split(":");
    if (parts.length === 2) {
      const [min, sec] = parts.map(parseFloat);
      return min * 60 + sec;
    }
    if (parts.length === 3) {
      const [hr, min, sec] = parts.map(parseFloat);
      return hr * 3600 + min * 60 + sec;
    }
  }
  return parseFloat(time.replace("+", "").replace("s", ""));
};

const isRelativeTime = (time) => typeof time === "string" && time.trim().startsWith("+");

const formatTimeDelta = (time1, time2) => {
  const t1 = parseTimeToSeconds(time1);
  const t2 = parseTimeToSeconds(time2);

  if (t1 === null || t2 === null) return "--";

  if (isRelativeTime(time1) && !isRelativeTime(time2)) return time1;
  if (!isRelativeTime(time1) && isRelativeTime(time2)) return `-${time2}`;

  const delta = (t1 - t2).toFixed(3);
  return `${delta > 0 ? "+" : ""}${delta}s`;
};

const getDriverResultsByRound = (driver, type = "race_results", processedRaces) => {
  return processedRaces.map((race) => {
    const result = race[type]?.find((r) => r.driver === driver);
    return {
      circuit: race.circuit.split(" ")[0],
      position: result?.position ?? null,
      points: result?.points ?? 0,
      time: result?.time ?? null,
    };
  });
};

const getQualifyingResultsByRound = (driver, processedRaces) => {
  return processedRaces.map((race) => {
    const result = race.qualifying_results?.find((q) => q.driver === driver);
    return {
      circuit: race.circuit.split(" ")[0],
      grid: result?.position ?? null,
      time: result?.time ?? null,
    };
  });
};

const getWinStyle = (val1, val2, isLowerBetter = true) => {
  if (val1 === null || val2 === null) return {};
  if (val1 === val2) return { color: "gray" };
  return (isLowerBetter ? val1 < val2 : val1 > val2)
    ? { color: "limegreen", fontWeight: 500 }
    : { color: "tomato", fontWeight: 500 };
};

const HeadToHeadPage = () => {
  // Memoize processed races - only recompute if raw data changes
  const processedRaces = useMemo(() => {
    return processDriverChange(f1SeasonData.races);
  }, []);

  // Memoize all drivers list
  const allDrivers = useMemo(() => {
    return [...new Set(processedRaces.flatMap((r) => r.race_results.map((res) => res.driver)))];
  }, [processedRaces]);

  const [driver1, setDriver1] = useState(allDrivers[0]);
  const [driver2, setDriver2] = useState(allDrivers[1]);

  // Memoize driver data to prevent recalculation on every render
  const driverData = useMemo(() => {
    return {
      quali1: getQualifyingResultsByRound(driver1, processedRaces),
      quali2: getQualifyingResultsByRound(driver2, processedRaces),
      sprint1: getDriverResultsByRound(driver1, "sprint_results", processedRaces),
      sprint2: getDriverResultsByRound(driver2, "sprint_results", processedRaces),
      races1: getDriverResultsByRound(driver1, "race_results", processedRaces),
      races2: getDriverResultsByRound(driver2, "race_results", processedRaces),
    };
  }, [driver1, driver2, processedRaces]);

  const { quali1, quali2, sprint1, sprint2, races1, races2 } = driverData;

  return (
    <div style={{ 
      padding: window.innerWidth < 768 ? "1rem" : "2rem", 
      width: "100%", 
      boxSizing: "border-box" 
    }}>
      <h1 style={{ 
        textAlign: "center", 
        fontSize: window.innerWidth < 768 ? "1.5rem" : "2rem", 
        marginBottom: "1rem" 
      }}>
        2025 Head-to-Head Driver Comparison
      </h1>

      <div style={{ 
        display: "flex", 
        flexDirection: window.innerWidth < 768 ? "column" : "row",
        justifyContent: "center", 
        gap: "1rem", 
        marginBottom: "2rem" 
      }}>
        <select 
          value={driver1} 
          onChange={(e) => setDriver1(e.target.value)}
          style={{
            padding: "0.75rem",
            fontSize: "1rem",
            borderRadius: "6px",
            border: "1px solid #555",
            backgroundColor: "#333",
            color: "#fff",
            width: window.innerWidth < 768 ? "100%" : "auto"
          }}
        >
          {allDrivers.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <select 
          value={driver2} 
          onChange={(e) => setDriver2(e.target.value)}
          style={{
            padding: "0.75rem",
            fontSize: "1rem",
            borderRadius: "6px",
            border: "1px solid #555",
            backgroundColor: "#333",
            color: "#fff",
            width: window.innerWidth < 768 ? "100%" : "auto"
          }}
        >
          {allDrivers.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </div>

      {/* Qualifying Comparison */}
      <section style={{ marginBottom: "3rem" }}>
        <h2 style={{ fontSize: window.innerWidth < 768 ? "1.3rem" : "1.5rem" }}>
          Qualifying Comparison
        </h2>
        {window.innerWidth < 768 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {quali1.map((q1, i) => {
              const q2 = quali2[i];
              const gridDelta = q1.grid !== null && q2.grid !== null ? q1.grid - q2.grid : null;
              return (
                <div key={`q-${i}`} style={{
                  backgroundColor: "#2a2a2a",
                  borderRadius: "8px",
                  padding: "1rem",
                  border: "1px solid #404040"
                }}>
                  <h4 style={{ margin: "0 0 0.5rem 0", color: "#fff" }}>
                    {q1.circuit}
                  </h4>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                    <div>
                      <div style={{ fontSize: "0.9rem", color: "#ccc" }}>{driver1}</div>
                      <div style={{ fontWeight: "bold", color: getWinStyle(q1.grid, q2.grid).color || "#fff" }}>
                        P{q1.grid} ({q1.time || "--"})
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.9rem", color: "#ccc" }}>{driver2}</div>
                      <div style={{ fontWeight: "bold", color: getWinStyle(q2.grid, q1.grid).color || "#fff" }}>
                        P{q2.grid} ({q2.time || "--"})
                      </div>
                    </div>
                  </div>
                  {gridDelta !== null && (
                    <div style={{ marginTop: "0.5rem", textAlign: "center", fontSize: "0.9rem", color: "#aaa" }}>
                      Δ: {gridDelta > 0 ? "+" : ""}{gridDelta}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th>Track</th>
                <th>{driver1}</th>
                <th>{driver2}</th>
                <th>Grid Diff</th>
                <th>Time Diff</th>
              </tr>
            </thead>
            <tbody>
              {quali1.map((q1, i) => {
                const q2 = quali2[i];
                const gridDelta = q1.grid !== null && q2.grid !== null ? q1.grid - q2.grid : null;
                return (
                  <tr key={`q-${i}`}>
                    <td>{q1.circuit}</td>
                    <td style={getWinStyle(q1.grid, q2.grid)}>Grid P{q1.grid} ({q1.time ?? "--"})</td>
                    <td style={getWinStyle(q2.grid, q1.grid)}>Grid P{q2.grid} ({q2.time ?? "--"})</td>
                    <td>{gridDelta !== null ? `${gridDelta > 0 ? "+" : ""}${gridDelta}` : "--"}</td>
                    <td>{formatTimeDelta(q1.time, q2.time)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {/* Sprint Comparison */}
      <section style={{ marginBottom: "3rem" }}>
        <h2 style={{ fontSize: window.innerWidth < 768 ? "1.3rem" : "1.5rem" }}>
          Sprint Race Comparison
        </h2>
        {window.innerWidth < 768 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {sprint1.map((r1, i) => {
              const r2 = sprint2[i];
              const posDelta = r1.position !== null && r2.position !== null ? r1.position - r2.position : null;
              return (
                <div key={`s-${i}`} style={{
                  backgroundColor: "#2a2a2a",
                  borderRadius: "8px",
                  padding: "1rem",
                  border: "1px solid #404040"
                }}>
                  <h4 style={{ margin: "0 0 0.5rem 0", color: "#fff" }}>
                    {r1.circuit}
                  </h4>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                    <div>
                      <div style={{ fontSize: "0.9rem", color: "#ccc" }}>{driver1}</div>
                      <div style={{ fontWeight: "bold", color: getWinStyle(r1.position, r2.position).color || "#fff" }}>
                        P{r1.position} ({r1.time || "--"})
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.9rem", color: "#ccc" }}>{driver2}</div>
                      <div style={{ fontWeight: "bold", color: getWinStyle(r2.position, r1.position).color || "#fff" }}>
                        P{r2.position} ({r2.time || "--"})
                      </div>
                    </div>
                  </div>
                  {posDelta !== null && (
                    <div style={{ marginTop: "0.5rem", textAlign: "center", fontSize: "0.9rem", color: "#aaa" }}>
                      Δ: {posDelta > 0 ? "+" : ""}{posDelta}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th>Track</th>
                <th>{driver1}</th>
                <th>{driver2}</th>
                <th>Pos Diff</th>
                <th>Time Diff</th>
              </tr>
            </thead>
            <tbody>
              {sprint1.map((r1, i) => {
                const r2 = sprint2[i];
                const posDelta = r1.position !== null && r2.position !== null ? r1.position - r2.position : null;
                return (
                  <tr key={`s-${i}`}>
                    <td>{r1.circuit}</td>
                    <td style={getWinStyle(r1.position, r2.position)}>P{r1.position} ({r1.time ?? "--"})</td>
                    <td style={getWinStyle(r2.position, r1.position)}>P{r2.position} ({r2.time ?? "--"})</td>
                    <td>{posDelta !== null ? `${posDelta > 0 ? "+" : ""}${posDelta}` : "--"}</td>
                    <td>{formatTimeDelta(r1.time, r2.time)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {/* Race Comparison */}
      <section>
        <h2 style={{ fontSize: window.innerWidth < 768 ? "1.3rem" : "1.5rem" }}>
          Race Results Comparison
        </h2>
        {window.innerWidth < 768 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {races1.map((r1, i) => {
              const r2 = races2[i];
              const posDelta = r1.position !== null && r2.position !== null ? r1.position - r2.position : null;
              return (
                <div key={`r-${i}`} style={{
                  backgroundColor: "#2a2a2a",
                  borderRadius: "8px",
                  padding: "1rem",
                  border: "1px solid #404040"
                }}>
                  <h4 style={{ margin: "0 0 0.5rem 0", color: "#fff" }}>
                    {r1.circuit}
                  </h4>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                    <div>
                      <div style={{ fontSize: "0.9rem", color: "#ccc" }}>{driver1}</div>
                      <div style={{ fontWeight: "bold", color: getWinStyle(r1.position, r2.position).color || "#fff" }}>
                        P{r1.position} ({r1.time || "--"})
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.9rem", color: "#ccc" }}>{driver2}</div>
                      <div style={{ fontWeight: "bold", color: getWinStyle(r2.position, r1.position).color || "#fff" }}>
                        P{r2.position} ({r2.time || "--"})
                      </div>
                    </div>
                  </div>
                  {posDelta !== null && (
                    <div style={{ marginTop: "0.5rem", textAlign: "center", fontSize: "0.9rem", color: "#aaa" }}>
                      Δ: {posDelta > 0 ? "+" : ""}{posDelta}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th>Track</th>
                <th>{driver1}</th>
                <th>{driver2}</th>
                <th>Pos Diff</th>
                <th>Time Diff</th>
              </tr>
            </thead>
            <tbody>
              {races1.map((r1, i) => {
                const r2 = races2[i];
                const posDelta = r1.position !== null && r2.position !== null ? r1.position - r2.position : null;
                return (
                  <tr key={`r-${i}`}>
                    <td>{r1.circuit}</td>
                    <td style={getWinStyle(r1.position, r2.position)}>P{r1.position} ({r1.time ?? "--"})</td>
                    <td style={getWinStyle(r2.position, r1.position)}>P{r2.position} ({r2.time ?? "--"})</td>
                    <td>{posDelta !== null ? `${posDelta > 0 ? "+" : ""}${posDelta}` : "--"}</td>
                    <td>{formatTimeDelta(r1.time, r2.time)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
};

export default HeadToHeadPage;