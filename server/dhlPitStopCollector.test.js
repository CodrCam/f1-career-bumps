import assert from 'node:assert/strict';
import test from 'node:test';
import {
  mergeDhlPitStopsIntoSeason,
  parseDhlEventInventory,
  parseDhlPitStopResponse,
} from './dhlPitStopCollector.js';

test('discovers the DHL pit-stop event endpoint and preserves race order', () => {
  const html = `
    <section
      id="element_event"
      data-url="/api/f1-award-element-data/7373"
      data-type="pit_stop"
      data-statistic="event_info"
    ></section>
    <input type="radio" name="f1-award-form-7373" value="1167" />
    <label><span class="flag"></span><span>Albert Park</span></label>
    <input type="radio" name="f1-award-form-7373" value="1168" />
    <label><span class="flag"></span><span>Shanghai</span></label>
  `;

  assert.deepEqual(parseDhlEventInventory(html), {
    dataPath: '/api/f1-award-element-data/7373',
    events: [
      { round: 1, eventId: 1167, circuit: 'Albert Park' },
      { round: 2, eventId: 1168, circuit: 'Shanghai' },
    ],
  });
});

test('parses every DHL table stop and enriches chart-ranked entries', () => {
  const payload = {
    data: {
      sort: '1',
      event_id: 1167,
      list_item_title: 'Australia',
      chart: [{
        id: 1,
        driverNr: 16,
        tla: 'LEC',
        firstName: 'Charles',
        lastName: 'Leclerc',
        team: 'Ferrari',
        duration: 2.17,
        lap: 20,
        irregular: false,
        notes: '',
      }],
    },
    htmlList: {
      table: `
        <table>
          <tr><th>Pos.</th><th>Team</th><th>Driver</th><th>Time</th><th>Lap</th><th>Points</th></tr>
          <tr><td>1</td><td>Ferrari</td><td>Leclerc</td><td>2.17</td><td>20</td><td>25</td></tr>
          <tr><td>2</td><td>Cadillac</td><td>Perez</td><td>2.41</td><td>21</td><td>18</td></tr>
        </table>
      `,
    },
  };

  const race = parseDhlPitStopResponse(payload);

  assert.equal(race.round, 1);
  assert.equal(race.stops.length, 2);
  assert.equal(race.stops[0].driver_full_name, 'Charles Leclerc');
  assert.equal(race.stops[1].team, 'Cadillac');
  assert.equal(race.stops[1].service_time_seconds, 2.41);
});

test('merges DHL service times into existing race records', () => {
  const season = {
    races: [{ round: 1, grand_prix: 'Australia Grand Prix', pit_stops: [{ lap: 20 }] }],
  };
  const dhlSeason = {
    source: 'DHL Fastest Pit Stop Award',
    source_url: 'https://example.test/dhl',
    collected_at: '2026-03-08T00:00:00.000Z',
    races: [{ round: 1, event_id: 1167, stops: [{ lap: 20, service_time_seconds: 2.17 }] }],
  };

  const merged = mergeDhlPitStopsIntoSeason(season, dhlSeason);

  assert.equal(merged.races[0].pit_stops.length, 1);
  assert.equal(merged.races[0].dhl_pit_stops[0].service_time_seconds, 2.17);
  assert.equal(merged.races[0].pit_stop_sources.dhl_event_id, 1167);
});
