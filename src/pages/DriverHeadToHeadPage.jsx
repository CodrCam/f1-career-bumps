import React, { useState } from "react";
import f1SeasonData from "../data/f1_2025_season.json";

const getDriverResultsByRound = (driver) => {
  return f1SeasonData.races.map((race) => {
    const result = race.race_results.find((r) => r.driver === driver);
    return {
      circuit: race.circuit.split(" ")[0],
      position: result?.position ?? null,
      points: result?.points ?? 0,
    };
  });
};

const getQualifyingResultsByRound = (driver) => {
  return f1SeasonData.races.map((race) => {
    const result = race.qualifying_results?.find((q) => q.driver === driver);
    return {
      circuit: race.circuit.split(" ")[0],
      grid: result?.position ?? null,
      time: result?.time ?? null,
    };
  });
};

const formatTimeDelta = (time1, time2) => {
  if (!time1 || !time2 || time1 === "No Time" || time2 === "No Time") return "--";
  const parseTime = (t) => {
    const parts = t.split(":"), len = parts.length;
    return len === 3
      ? parseFloat(parts[0]) * 60 + parseFloat(parts[1]) + parseFloat(parts[2])
      : parseFloat(t.replace(/[^0-9.]/g, ""));
  };
  const t1 = parseTime(time1);
  const t2 = parseTime(time2);
  const delta = (t1 - t2).toFixed(3);
  return `${delta > 0 ? "+" : ""}${delta}s`;
};

const getWinStyle = (val1, val2, isLowerBetter = true) => {
  if (val1 === null || val2 === null) return {};
  if (val1 === val2) return { color: "gray" };
  return (isLowerBetter ? val1 < val2 : val1 > val2)
    ? { color: "limegreen", fontWeight: 500 }
    : { color: "tomato", fontWeight: 500 };
};

const HeadToHeadPage = () => {
  const allDrivers = [
    ...new Set(
      f1SeasonData.races.flatMap((r) => r.race_results.map((res) => res.driver))
    ),
  ];

  const [driver1Quali, setDriver1Quali] = useState(allDrivers[0]);
  const [driver2Quali, setDriver2Quali] = useState(allDrivers[1]);
  const [driver1Race, setDriver1Race] = useState(allDrivers[0]);
  const [driver2Race, setDriver2Race] = useState(allDrivers[1]);

  const quali1 = getQualifyingResultsByRound(driver1Quali);
  const quali2 = getQualifyingResultsByRound(driver2Quali);
  const races1 = getDriverResultsByRound(driver1Race);
  const races2 = getDriverResultsByRound(driver2Race);

  return (
    <div style={{ padding: "2rem", width: "100vw", boxSizing: "border-box" }}>
      <h1 style={{ textAlign: "center", fontSize: "2rem", marginBottom: "1rem" }}>
        2025 Head-to-Head Driver Comparison
      </h1>

      {/* Qualifying Comparison */}
      <section style={{ marginBottom: "3rem" }}>
        <h2>Qualifying Comparison</h2>
        <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem" }}>
          <select value={driver1Quali} onChange={(e) => setDriver1Quali(e.target.value)}>
            {allDrivers.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <select value={driver2Quali} onChange={(e) => setDriver2Quali(e.target.value)}>
            {allDrivers.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th>Track</th>
              <th>{driver1Quali}</th>
              <th>{driver2Quali}</th>
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
                  <td style={getWinStyle(q1.grid, q2.grid)}>
                    Grid P{q1.grid} ({q1.time ?? "--"})
                  </td>
                  <td style={getWinStyle(q2.grid, q1.grid)}>
                    Grid P{q2.grid} ({q2.time ?? "--"})
                  </td>
                  <td>{gridDelta !== null ? `${gridDelta > 0 ? "+" : ""}${gridDelta}` : "--"}</td>
                  <td>{formatTimeDelta(q1.time, q2.time)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {/* Race Comparison */}
      <section>
        <h2>Race Results Comparison</h2>
        <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem" }}>
          <select value={driver1Race} onChange={(e) => setDriver1Race(e.target.value)}>
            {allDrivers.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <select value={driver2Race} onChange={(e) => setDriver2Race(e.target.value)}>
            {allDrivers.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th>Track</th>
              <th>{driver1Race}</th>
              <th>{driver2Race}</th>
              <th>Position Diff</th>
              <th>Points Diff</th>
            </tr>
          </thead>
          <tbody>
            {races1.map((r1, i) => {
              const r2 = races2[i];
              const posDelta = r1.position !== null && r2.position !== null
                ? r1.position - r2.position
                : null;

              const points1 = r1.points ?? 0;
              const points2 = r2.points ?? 0;
              const pointsDelta = points1 - points2;

              const colorStyle = posDelta === 0
                ? {}
                : {
                    color: posDelta < 0 ? "green" : "red",
                    fontWeight: "bold",
                  };

              return (
                <tr key={`r-${i}`}>
                  <td>{r1.circuit}</td>
                  <td>P{r1.position ?? "--"} ({points1} pts)</td>
                  <td>P{r2.position ?? "--"} ({points2} pts)</td>
                  <td style={colorStyle}>
                    {posDelta !== null ? `${posDelta > 0 ? "+" : ""}${posDelta}` : "--"}
                  </td>
                  <td style={{ fontWeight: "bold" }}>
                    {`${pointsDelta > 0 ? "+" : ""}${pointsDelta}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
};

export default HeadToHeadPage;
