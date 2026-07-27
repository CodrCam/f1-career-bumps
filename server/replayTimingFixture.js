import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { createFixtureTimingAdapter } from './fixtureTimingAdapter.js';
import { runRecordedTimingPipeline } from './fixtureIngestionPipeline.js';
import { createRawEventLogStore } from './rawEventLogStore.js';
import { createMemoryRaceEventLedger } from './raceEventLedger.js';

const { values } = parseArgs({
  options: {
    fixture: {
      type: 'string',
      short: 'f',
      default: resolve(import.meta.dirname, 'fixtures/timing/2026-round-99-race.jsonl'),
    },
    output: {
      type: 'string',
      short: 'o',
      default: resolve(import.meta.dirname, '../.data/fixture-replay'),
    },
  },
});

const adapter = createFixtureTimingAdapter({
  fixturePath: resolve(values.fixture),
});
const sessions = await adapter.discoverSessions();
if (!sessions.length) throw new Error('The timing fixture contains no sessions.');

const rawStore = createRawEventLogStore({
  bucket: null,
  localRoot: resolve(values.output),
});
const ledger = createMemoryRaceEventLedger();
const result = await runRecordedTimingPipeline({
  adapter,
  rawStore,
  ledger,
  session: sessions[0],
});

console.log(JSON.stringify({
  ok: true,
  session: result.session,
  rawBatches: result.rawBatches,
  messages: result.messages,
  normalizedEvents: result.normalizedEvents.length,
  pitStops: result.pitStops,
  anomalyEvents: result.anomalyEvents,
  ledgerWrites: result.ledgerWrites,
}, null, 2));

