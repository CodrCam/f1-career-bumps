import assert from 'node:assert/strict';
import test from 'node:test';
import {
  extractFormula1SessionLinks,
  parseFormula1Table,
} from './formula1SeasonBuilder.js';

const raceInfo = {
  baseRaceUrl: 'https://www.formula1.com/en/results/2026/races/1289/great-britain',
  raceResultUrl: 'https://www.formula1.com/en/results/2026/races/1289/great-britain/race-result',
};

test('discovers every session linked for a race and preserves nested practice paths', () => {
  const html = `
    <nav>
      <a href="/en/results/2026/races/1289/great-britain/practice/1">Practice 1</a>
      <a href="/en/results/2026/races/1289/great-britain/sprint-qualifying">Sprint Qualifying</a>
      <a href="/en/results/2026/races/1289/great-britain/pit-stop-summary">Pit Stop Summary</a>
      <a href="/en/results/2026/races/1289/great-britain/race-result">Race Result</a>
      <a href="/en/results/2026/races/1290/belgium/race-result">Other race</a>
    </nav>
  `;

  const links = extractFormula1SessionLinks(html, raceInfo);

  assert.deepEqual(
    links.map(({ key, path }) => ({ key, path })),
    [
      { key: 'practice_1_results', path: 'practice/1' },
      { key: 'sprint_qualifying_results', path: 'sprint-qualifying' },
      { key: 'pit_stops', path: 'pit-stop-summary' },
      { key: 'race_results', path: 'race-result' },
    ],
  );
});

test('parses Formula1.com result tables without depending on presentation classes', () => {
  const html = `
    <section id="results-table">
      <table>
        <thead>
          <tr><th>Pos.</th><th>No.</th><th>Driver</th><th>Team</th><th>Pts.</th></tr>
        </thead>
        <tbody>
          <tr><td>1</td><td>63</td><td>George Russell RUS</td><td>Mercedes</td><td>25</td></tr>
          <tr><td>2</td><td>12</td><td>Kimi Antonelli ANT</td><td>Mercedes</td><td>18</td></tr>
        </tbody>
      </table>
    </section>
  `;

  const table = parseFormula1Table(html);

  assert.deepEqual(table.headers, ['Pos.', 'No.', 'Driver', 'Team', 'Pts.']);
  assert.deepEqual(table.rows[0].values, ['1', '63', 'George Russell RUS', 'Mercedes', '25']);
  assert.equal(table.rows.length, 2);
});
