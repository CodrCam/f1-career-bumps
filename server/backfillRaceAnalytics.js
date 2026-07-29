import { spawn } from 'node:child_process';
import { parseArgs } from 'node:util';
import { buildFormula1Season } from './formula1SeasonBuilder.js';

const { values } = parseArgs({
  options: {
    year: { type: 'string', short: 'y' },
    from: { type: 'string', default: '1' },
    to: { type: 'string' },
    'no-dynamo': { type: 'boolean', default: false },
  },
});

const year = Number(values.year ?? new Date().getFullYear());
const fromRound = Number(values.from);
const toRound = values.to ? Number(values.to) : null;

if (
  !Number.isInteger(year)
  || !Number.isInteger(fromRound)
  || (toRound !== null && !Number.isInteger(toRound))
) {
  throw new Error('Year, from, and to values must be whole numbers.');
}

const season = await buildFormula1Season(year);
const rounds = season.races
  .map((race) => race.round)
  .filter((round) => round >= fromRound && (toRound === null || round <= toRound));

if (rounds.length === 0) {
  throw new Error(`No completed ${year} rounds were found in the requested range.`);
}

const runRound = (round) => new Promise((resolve, reject) => {
  const args = [
    'server/updateRacePipeline.js',
    '--year',
    String(year),
    '--round',
    String(round),
  ];

  if (values['no-dynamo']) args.push('--no-dynamo');

  const child = spawn(process.execPath, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
  });

  child.on('error', reject);
  child.on('exit', (code, signal) => {
    if (signal) {
      reject(new Error(`Round ${round} stopped with signal ${signal}.`));
      return;
    }
    if (code === 2) {
      resolve({ round, status: 'validation_failed' });
      return;
    }
    if (code !== 0) {
      reject(new Error(`Round ${round} exited with code ${code}.`));
      return;
    }
    resolve({ round, status: 'ready' });
  });
});

const results = [];
for (const round of rounds) {
  console.log(`\nUpdating ${year} round ${round} (${rounds.indexOf(round) + 1}/${rounds.length})`);
  results.push(await runRound(round));
}

console.log(JSON.stringify({
  ok: true,
  year,
  rounds,
  count: rounds.length,
  ready: results.filter((result) => result.status === 'ready').map((result) => result.round),
  validationFailed: results
    .filter((result) => result.status === 'validation_failed')
    .map((result) => result.round),
}, null, 2));
