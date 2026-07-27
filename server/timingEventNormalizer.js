import { analyzePitStopRecords } from '../src/utils/pitStopAnomalies.js';
import { buildRaceEvent } from './raceEventLedger.js';

export const TIMING_NORMALIZER_VERSION = 'fixture-normalizer-1.0.0';
export const PIT_EVENT_PROCESSING_VERSION = 'pit-event-analysis-1.0.0';

const eventTypeMap = {
  driver: 'driver_registered',
  pit_entry: 'pit_entry',
  pit_service: 'pit_service',
  pit_exit: 'pit_exit',
  race_control: 'race_control_notice',
  classification: 'classification',
};

const normalizedEventType = (message) => {
  if (message.type !== 'session_status') return eventTypeMap[message.type];
  if (message.payload?.status === 'started') return 'race_start';
  if (message.payload?.status === 'finished') return 'race_finish';
  return 'session_status';
};

export const normalizeTimingMessage = (
  message,
  {
    source,
    sourceSchemaVersion,
    rawBatch,
  } = {},
) => {
  const eventType = normalizedEventType(message);
  if (!eventType) throw new Error(`Unsupported fixture timing message type: ${message.type}`);

  return buildRaceEvent({
    year: message.year,
    round: message.round,
    sessionId: message.session_id,
    eventType,
    timestamp: message.occurred_at,
    source,
    sourceSchemaVersion,
    sourceEventId: message.id,
    confidence: 1,
    evidence: [{
      kind: 'raw_source_record',
      source,
      sourceEventId: message.id,
      rawBatchKey: rawBatch.key,
      rawBatchSha256: rawBatch.sha256,
    }],
    observed: {
      sequence: message.sequence,
      sessionType: message.session_type,
      ...message.payload,
    },
    derived: {},
    interpretation: {
      status: 'confirmed',
      summary: 'Observed source fact; no causal interpretation applied.',
    },
    processingVersion: TIMING_NORMALIZER_VERSION,
  });
};

const pitStopKey = (observed) => (
  `${observed.driver}:${observed.lap}:${observed.stop_number ?? 1}`
);

const secondsBetween = (start, end) => {
  const seconds = (Date.parse(end) - Date.parse(start)) / 1_000;
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
};

export const materializePitStops = (events) => {
  const stops = new Map();
  let neutralization = null;
  let neutralizationEvidence = [];

  [...events]
    .sort((left, right) => (
      left.timestamp.localeCompare(right.timestamp)
      || Number(left.observed.sequence) - Number(right.observed.sequence)
    ))
    .forEach((event) => {
      if (event.eventType === 'race_control_notice') {
        const phase = String(event.observed.phase ?? '').toLowerCase();
        const status = String(event.observed.status ?? '').toLowerCase();
        if (phase === 'deployed') {
          neutralization = status;
          neutralizationEvidence = [{
            kind: 'race_control',
            source: event.source,
            eventId: event.eventId,
            message: event.observed.message,
          }];
        } else if (phase === 'ended' || phase === 'resumed') {
          neutralization = null;
          neutralizationEvidence = [];
        }
        return;
      }

      if (!['pit_entry', 'pit_service', 'pit_exit'].includes(event.eventType)) return;
      const key = pitStopKey(event.observed);
      const stop = stops.get(key) ?? {
        seasonYear: event.year,
        round: event.round,
        grandPrix: event.observed.grand_prix,
        driver: event.observed.driver_name ?? event.observed.driver,
        driverCode: event.observed.driver,
        team: event.observed.team,
        lap: Number(event.observed.lap),
        stopNumber: Number(event.observed.stop_number ?? 1),
        serviceTime: null,
        pitLaneTime: null,
        transitTime: null,
        entryAt: null,
        exitAt: null,
        eventEvidence: [],
        neutralizationType: neutralization,
        raceControlEvidence: [...neutralizationEvidence],
        serviceSource: null,
        pitLaneSource: null,
      };

      stop.eventEvidence.push({
        kind: event.eventType,
        source: event.source,
        eventId: event.eventId,
      });

      if (event.eventType === 'pit_entry') {
        stop.entryAt = event.timestamp;
        stop.neutralizationType = neutralization;
        stop.raceControlEvidence = [...neutralizationEvidence];
      } else if (event.eventType === 'pit_service') {
        stop.serviceTime = Number(event.observed.service_seconds);
        stop.serviceSource = event.source;
      } else if (event.eventType === 'pit_exit') {
        stop.exitAt = event.timestamp;
        stop.pitLaneSource = event.source;
      }

      stops.set(key, stop);
    });

  return [...stops.values()]
    .map((stop) => {
      const pitLaneTime = secondsBetween(stop.entryAt, stop.exitAt);
      const transitTime = Number.isFinite(pitLaneTime) && Number.isFinite(stop.serviceTime)
        ? pitLaneTime - stop.serviceTime
        : null;
      return {
        ...stop,
        id: [
          stop.seasonYear,
          stop.round,
          stop.driverCode,
          stop.lap,
          stop.stopNumber,
        ].join('-'),
        pitLaneTime,
        transitTime,
        hasBreakdown: Number.isFinite(transitTime) && transitTime >= 0,
      };
    })
    .sort((left, right) => (
      String(left.entryAt ?? '').localeCompare(String(right.entryAt ?? ''))
    ));
};

export const buildPitAnomalyEvents = (pitStops, sessionId) => (
  analyzePitStopRecords(pitStops)
    .filter((stop) => stop.isAnomaly)
    .map((stop) => buildRaceEvent({
      year: stop.seasonYear,
      round: stop.round,
      sessionId,
      eventType: 'pit_stop_anomaly',
      timestamp: stop.exitAt,
      source: 'slipstream-analysis',
      sourceSchemaVersion: 1,
      sourceEventId: stop.id,
      confidence: 0.95,
      evidence: [
        ...stop.eventEvidence,
        ...stop.raceControlEvidence,
      ],
      observed: {
        driver: stop.driverCode,
        driver_name: stop.driver,
        team: stop.team,
        lap: stop.lap,
        stop_number: stop.stopNumber,
        service_time_seconds: stop.serviceTime,
        pit_lane_time_seconds: stop.pitLaneTime,
        transit_time_seconds: stop.transitTime,
        neutralization_type: stop.neutralizationType,
      },
      derived: {
        anomaly_type: stop.anomalyType,
        anomaly_score: stop.anomalyScore,
        expected_service_time_seconds: stop.expectedServiceTime,
        expected_pit_lane_time_seconds: stop.expectedPitLaneTime,
        expected_transit_time_seconds: stop.expectedTransitTime,
        service_score: stop.serviceAnomalyScore,
        pit_lane_score: stop.laneAnomalyScore,
        transit_score: stop.transitAnomalyScore,
      },
      interpretation: {
        status: stop.explanationStatus,
        summary: stop.explanation,
      },
      processingVersion: PIT_EVENT_PROCESSING_VERSION,
    }))
);
