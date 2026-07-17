import fs from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import initSqlJs from 'sql.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const defaultDbPath = path.join(projectRoot, 'db', 'f1.sqlite');
const defaultSeedPath = path.join(projectRoot, 'src', 'data', 'f1_2025_season.json');
const sqlJsDistPath = path.join(projectRoot, 'node_modules', 'sql.js', 'dist');

const resultTypes = [
  'sprint_results',
  'sprint_qualifying_results',
  'qualifying_results',
  'race_results',
];

const schema = `
CREATE TABLE IF NOT EXISTS seasons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  year INTEGER NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS races (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  season_id INTEGER NOT NULL,
  round INTEGER NOT NULL,
  grand_prix TEXT NOT NULL,
  date TEXT NOT NULL,
  circuit TEXT NOT NULL,
  UNIQUE(season_id, round),
  FOREIGN KEY(season_id) REFERENCES seasons(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS event_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  race_id INTEGER NOT NULL,
  session_type TEXT NOT NULL,
  position INTEGER,
  driver TEXT NOT NULL,
  team TEXT NOT NULL,
  points REAL DEFAULT 0,
  grid INTEGER,
  time TEXT,
  status TEXT,
  result_order INTEGER NOT NULL,
  FOREIGN KEY(race_id) REFERENCES races(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_races_season_round ON races(season_id, round);
CREATE INDEX IF NOT EXISTS idx_results_race_session ON event_results(race_id, session_type, result_order);
CREATE INDEX IF NOT EXISTS idx_results_driver ON event_results(driver);
CREATE INDEX IF NOT EXISTS idx_results_team ON event_results(team);
`;

const asNullable = (value) => value === undefined ? null : value;

const firstValue = (db, sql, params = []) => {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const value = stmt.step() ? Object.values(stmt.getAsObject())[0] : null;
  stmt.free();
  return value;
};

const allRows = (db, sql, params = []) => {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];

  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }

  stmt.free();
  return rows;
};

const rowToResult = (row) => {
  const result = {
    position: row.position,
    driver: row.driver,
    team: row.team,
    points: row.points ?? 0,
  };

  if (row.grid !== null && row.grid !== undefined) result.grid = row.grid;
  if (row.time) result.time = row.time;
  if (row.status) result.status = row.status;

  return result;
};

const insertResult = (db, raceId, sessionType, result, index) => {
  db.run(
    `INSERT INTO event_results (
      race_id, session_type, position, driver, team, points, grid, time, status, result_order
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      raceId,
      sessionType,
      asNullable(result.position),
      result.driver,
      result.team,
      asNullable(result.points) ?? 0,
      asNullable(result.grid),
      asNullable(result.time),
      asNullable(result.status),
      index,
    ],
  );
};

const seedSeason = async (db, seedPath, year = 2025) => {
  const seed = JSON.parse(await readFile(seedPath, 'utf8'));

  db.run('BEGIN TRANSACTION');
  try {
    db.run('INSERT OR IGNORE INTO seasons (year) VALUES (?)', [year]);
    const seasonId = firstValue(db, 'SELECT id FROM seasons WHERE year = ?', [year]);

    db.run('DELETE FROM event_results WHERE race_id IN (SELECT id FROM races WHERE season_id = ?)', [seasonId]);
    db.run('DELETE FROM races WHERE season_id = ?', [seasonId]);

    for (const race of seed.races) {
      db.run(
        `INSERT INTO races (season_id, round, grand_prix, date, circuit)
         VALUES (?, ?, ?, ?, ?)`,
        [seasonId, race.round, race.grand_prix, race.date, race.circuit],
      );

      const raceId = firstValue(
        db,
        'SELECT id FROM races WHERE season_id = ? AND round = ?',
        [seasonId, race.round],
      );

      for (const sessionType of resultTypes) {
        const results = race[sessionType] ?? [];
        results.forEach((result, index) => insertResult(db, raceId, sessionType, result, index));
      }
    }

    db.run('COMMIT');
  } catch (error) {
    db.run('ROLLBACK');
    throw error;
  }
};

export const createF1Database = async ({
  dbPath = defaultDbPath,
  seedPath = defaultSeedPath,
} = {}) => {
  const SQL = await initSqlJs({
    locateFile: (file) => path.join(sqlJsDistPath, file),
  });

  const db = fs.existsSync(dbPath)
    ? new SQL.Database(fs.readFileSync(dbPath))
    : new SQL.Database();

  db.run(schema);

  const seasonCount = firstValue(db, 'SELECT COUNT(*) AS count FROM seasons');
  if (!seasonCount) {
    await seedSeason(db, seedPath);
    await mkdir(path.dirname(dbPath), { recursive: true });
    await writeFile(dbPath, Buffer.from(db.export()));
  }

  const save = async () => {
    await mkdir(path.dirname(dbPath), { recursive: true });
    await writeFile(dbPath, Buffer.from(db.export()));
  };

  return {
    getSeason(year) {
      const season = allRows(db, 'SELECT id, year FROM seasons WHERE year = ?', [year])[0];
      if (!season) return null;

      const races = allRows(
        db,
        `SELECT id, round, grand_prix, date, circuit
         FROM races
         WHERE season_id = ?
         ORDER BY round ASC`,
        [season.id],
      ).map((race) => {
        const raceResults = allRows(
          db,
          `SELECT session_type, position, driver, team, points, grid, time, status
           FROM event_results
           WHERE race_id = ?
           ORDER BY session_type ASC, result_order ASC`,
          [race.id],
        );

        const hydratedRace = {
          round: race.round,
          grand_prix: race.grand_prix,
          date: race.date,
          circuit: race.circuit,
          sprint_results: [],
          sprint_qualifying_results: [],
          qualifying_results: [],
          race_results: [],
        };

        for (const row of raceResults) {
          hydratedRace[row.session_type].push(rowToResult(row));
        }

        return hydratedRace;
      });

      return { races };
    },

    getSeasonSummary(year) {
      return allRows(
        db,
        `SELECT
          s.year,
          COUNT(DISTINCT r.id) AS rounds,
          COUNT(er.id) AS results
         FROM seasons s
         LEFT JOIN races r ON r.season_id = s.id
         LEFT JOIN event_results er ON er.race_id = r.id
         WHERE s.year = ?
         GROUP BY s.id, s.year`,
        [year],
      )[0] ?? null;
    },

    async reseed(year = 2025) {
      await seedSeason(db, seedPath, year);
      await save();
    },

    save,
    close() {
      db.close();
    },
  };
};
