# Race ingestion audit and architecture decision

Status: fixture and recorder-control-plane foundations implemented; live-source activation is blocked pending source authorization  
Date: 2026-07-27  
Scope: race/session ingestion, raw retention, normalization, event ledger, anomaly analysis, and publication

## Decision

Build a focused, source-agnostic session recorder rather than a clone of a public timing API.
The recorder will run only inside authorized session windows, retain immutable compressed source
batches in S3, normalize them into deterministic append-only race events in DynamoDB, and build
versioned analytical materializations for the existing API and frontend.

The first implementation uses only a self-owned synthetic fixture. No new Formula1.com, FastF1,
OpenF1, or DHL live adapter is activated by this work.

For a future authorized source, use EventBridge Scheduler to start a short-lived ECS Fargate task
before each relevant session. A recorder needs to remain connected, checkpoint, and reconnect for
longer than a Netlify Function or AWS Lambda invocation permits. Netlify remains the static frontend
host; the existing API Gateway/Lambda read path remains suitable for bounded reads.

```text
authorized schedule
  -> one-time EventBridge schedule or rate-limited public check
  -> SQS availability-check queue
  -> Lambda probe + single dispatch reservation
  -> ECS Fargate recorder/replay task (only after a positive probe)
  -> S3 raw-events/*.jsonl.gz (immutable batches)
  -> DynamoDB RACE_EVENTS partition (conditional append)
  -> deterministic materializations + publication gate
  -> existing API Gateway/Lambda read models
  -> Netlify frontend
```

No MongoDB, Kafka, MQTT broker, or always-running service is required for the expected message
volume. OpenF1 may use MQTT/WebSocket as a transport for paid live access, but the project does not
need to operate its own broker.

## Why the current refresh can miss a race

The current flow is a completed-race repair job, not a session ingestion system:

1. `.github/workflows/update-race-data.yml` runs only every six hours on Sunday, Monday, and
   Tuesday. A delayed result published after Tuesday waits until the next scheduled race week unless
   someone dispatches the workflow manually.
2. The workflow is hard-coded to 2026 and has no season rollover or scheduled-session discovery.
3. `buildFormula1Season()` treats a race as completed only when the Formula1.com race-result table
   contains rows. It cannot record a live session, and a delayed/changed HTML table makes the race
   invisible to the refresh.
4. `refreshRacePublications.js` attempts at most the newest two missing rounds per run. Older gaps are
   explicitly deferred. Sequential collection plus the 55-minute workflow timeout can leave those
   gaps in place.
5. Each FastF1 attempt can run for 12 minutes, with retries and a later OpenF1 fallback. A failed
   process has no per-message checkpoint; the raw timing snapshot is written only after full
   collection succeeds.
6. Missing detection is based on whether a round already has an analytics index. It does not
   automatically replay stale calculation versions or repair partially complete capabilities.
   Publication-status repair can mark legacy analytics published without re-running source
   validation.
7. The collectors are request/response snapshots. They have no shared source contract, connection
   health, cursor, authentication renewal, or reconnect/backoff lifecycle.
8. Formula1.com session pages and the DHL page are fetched by HTML automation. Their authorization
   status is not represented in code or enforced before collection.

The existing unique S3 snapshot keys, validation checks, degraded publication state, and missing
round retry are useful recovery pieces. They cannot recover messages that were never recorded.

## Source authorization matrix

This is an engineering gate, not legal advice. “Blocked” means the adapter must not be implemented
or activated without written permission or a license that covers the planned operation.

| Source | Exact project use | Published terms/evidence | Ingest | Store | Transform | Public derived display | Decision |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Slipstream synthetic fixture | `server/fixtures/timing/*.jsonl` | Self-authored; no upstream records | Yes | Yes | Yes | Yes | Approved and implemented |
| Formula1.com results pages | `https://www.formula1.com/en/results/{year}/races` and linked session pages | Formula 1 says timing/results are protected by copyright and database rights and substantial data may not be reproduced or used commercially through scraping. See [Formula 1 Guidelines](https://www.formula1.com/en/information/guidelines.4EOKE9RRqevL4niTK9kWyt) and [Legal Notices](https://www.formula1.com/en/information/legal-notices.7egvZU48hzrypubGBNcQKt). | No automated approval identified | No | No | Incidental editorial facts only, subject to review | Blocked; existing collector needs written authorization review |
| FastF1 / `livetiming.formula1.com` | `fastf1` package loads detailed timing | The [FastF1 repository](https://github.com/theOehrly/Fast-F1) is unofficial. Its [MIT license](https://raw.githubusercontent.com/theOehrly/Fast-F1/master/LICENSE) licenses software, not Formula 1’s underlying timing/database rights. Formula 1’s timing-data restrictions still apply. | Unclear | Unclear | Unclear | Unclear | Blocked for a new live/production adapter pending upstream permission |
| OpenF1 historical API | `https://api.openf1.org/v1/*` after a race | [OpenF1 docs](https://openf1.org/docs/) state historical data is free without authentication. The repository uses [CC BY-NC-SA 4.0](https://raw.githubusercontent.com/br-g/openf1/main/LICENSE), including noncommercial/share-alike limits and only rights the licensor can grant. OpenF1 is unofficial and its repository identifies F1 live-timing ingestion. | Technically available; rights chain unclear | Unclear | Noncommercial terms may apply | Attribution/share-alike and underlying rights unresolved | Keep existing fallback code, but do not expand or treat it as production-authorized until clarified in writing |
| OpenF1 live API | Paid OAuth access, WebSocket/MQTT transport | [OpenF1 authentication docs](https://openf1.org/auth.html) require OAuth for live data; [API docs](https://openf1.org/docs/) say real-time access requires a paid subscription. A subscription alone does not document storage/public-display rights. | Subscription required | Unclear | Unclear | Unclear | Blocked until plan terms and underlying display/storage rights are confirmed |
| DHL Fastest Pit Stop Award | `https://inmotion.dhl/en/formula-1/fastest-pit-stop-award` and its page-discovered data endpoint | DHL terms prohibit automated systems used to access/scrape/retrieve site content without consent. See [DHL Terms of Use](https://del.dhl.com/terms-of-use.xhtml?ctrycode=tr&langcode=en). | No | No | No | No | Blocked pending written DHL permission |
| Licensed provider placeholder | Contracted schedule/timing feed | Provider contract and data-display schedule must be attached to adapter metadata | Contract | Contract | Contract | Contract | Preferred production source |

Before changing any row to approved, record the terms URL/contract identifier, reviewer, review date,
allowed session types, retention period, permitted transformations, attribution, rate limits, and
public-display limits in the adapter metadata. Technical accessibility is not approval.

## Reuse versus change

### Reuse

- `server/rawDataStore.js`: keep the S3/local storage selection and compressed-object pattern for
  post-session snapshots and analytical artifacts.
- Existing S3 bucket and lifecycle controls: add an immutable `raw-events/` prefix rather than a new
  database.
- Existing DynamoDB table: use an isolated `RACE_EVENTS#year#round` partition so analytics rebuilds
  cannot delete source-derived events.
- `racePublicationStatus.js`, source validation, and versioned analytics: retain as the publication
  gate and extend them with recorder coverage/checkpoint health.
- Existing API Gateway/Lambda readers and `/api/v2` read models: add materializations behind the
  current endpoints instead of exposing a public raw-data API.
- Existing `raceAnalytics.js`, Race Dossier, Pit Lane models, and fallback retry scripts: evolve them
  to consume ledger/materialized data.
- OpenF1 fallback code remains present while a future authorized source shadows multiple weekends.

### Change

- Replace source-specific entry points with the common adapter contract in
  `server/timingSourceAdapter.js`.
- Record bounded raw JSONL batches during a session rather than waiting for one complete snapshot.
- Add cursor/checkpoint and recorder-health items before live shadowing.
- Use conditional event puts and never delete the event partition. Corrections append a new event
  with `supersedesEventId`.
- Separate observed facts, derived measurements, interpretations, and explanation status in every
  analytical event.
- Re-run materializations when processing versions change, even when a round already has analytics.
- Treat authorization metadata as an executable gate, not documentation alone.
- Do not put the long-running recorder in Netlify Functions. `netlify.toml` currently contains only
  frontend build, redirect, and header rules, which should remain that way.

## Event and raw-log decisions

Raw batches:

- gzip-compressed NDJSON under
  `raw-events/{year}/round-NN/{session}/{source}/batch-{first}-{last}-{hash}.jsonl.gz`;
- source records are preserved without normalization;
- content hash plus create-only writes make fixture replay idempotent;
- no mutable `latest` object is required for the event log;
- a future recorder should flush on both a short interval and a maximum batch count.

Race events:

- partition key `RACE_EVENTS#{year}#{round}` is separate from replaceable analytics partitions;
- event IDs are deterministic hashes of session, type, timestamp, source identity, observed/derived
  data, and processing version;
- conditional DynamoDB puts make retries and replay idempotent;
- `source`, source schema, source event ID, timestamp, confidence, evidence, processing version,
  observed facts, derived values, and interpretation are retained;
- the schema accepts race start/finish, positions/overtakes, pit entry/service/exit, compounds,
  flags/neutralization, notices/penalties, contact/damage evidence, weather, retirement, fastest lap,
  pace change, classification, and superseding correction events without changing storage.

Public API responses remain curated materializations. No general-purpose raw event redistribution
endpoint is planned.

## Pit anomaly method

For each race, matched stops establish robust medians for service, full-lane, and transit time.
Median absolute deviation (with a standard-deviation fallback) produces comparable scores. A minimum
sample prevents small fields from being labelled.

The deterministic classifier distinguishes:

- high service / normal transit;
- normal service / high transit;
- high service / high transit;
- unusually quick full-lane time while an observed safety-car or VSC state is active.

A duration does not prove a wheel-gun issue, unsafe release, traffic, damage, or strategic intent.
Slow shapes are `unexplained` until corroborating evidence exists. Neutralization can be `confirmed`
as context while the text explicitly avoids claiming that it caused the duration. Future enrichment
may move an explanation to `likely` or `confirmed` only when linked race-control, contact, tyre,
lap-time, or other permitted evidence supports that wording.

## Independently deployable phases

1. **Fixture foundation — implemented here.** Contract, authorization gate, replay adapter,
   append-only raw batches, normalized race events, in-memory/Dynamo ledger implementations, robust
   pit anomalies, tests, and Pit Lane visualization.
2. **Authorized shadow recorder — control plane implemented, provider/infrastructure pending.**
   The source-agnostic recorder now has local and conditional DynamoDB session state, single-writer
   leases, durable cursor/health checkpoints, interval/count batch flushing, reconnect recovery,
   persistent local events, availability probes, an SQS check queue, duplicate-dispatch
   reservations, one-time schedule payloads, a rate-limited public check API, and a status read
   model. Parameterized Fargate, Lambda, Scheduler, IAM, queue, and public-API resources are defined
   in CloudFormation but are not deployed. Choose a licensed/clearly permitted source; add its
   adapter; then build/deploy artifacts, create session schedules, and add lifecycle/alarms. Do not
   publish during shadowing.
3. **Replay and materialization.** Backfill from raw logs, add remaining event families, add
   correction/supersession tests, compare materializations against the retained fallback, and expose
   recorder coverage in publication status.
4. **Editorial integration.** Feed the ledger-derived Race Story, Pace Lab, Results, Comparison, and
   Pit Lane materializations through existing `/api/v2` models. Keep confirmed/likely/unexplained
   language and evidence links.
5. **Shadow validation and cutover.** Shadow at least three representative race weekends (including
   a sprint and a disrupted race), measure completeness/recovery, then make the authorized adapter
   primary. Retain OpenF1 only as legally approved and operationally necessary.

## First-slice operation

`npm run pipeline:fixture` replays the synthetic session and writes only to
`.data/fixture-replay`. It does not load `.env.local`, call a network source, or create a production
client. The automated test runs the same stream twice and verifies raw create-only behavior and
ledger deduplication.

`npm run timing:prepare:fixture` registers the synthetic session in scheduled state.
`npm run timing:record:fixture` exercises the live-shaped recorder and persists state, raw batches,
and normalized events below `.data/timing-recorder`. The local API exposes operational status at
`GET /api/v2/timing-recorder/sessions`, but it exposes neither raw timing records nor object URIs.
See `docs/timing-recorder-runbook.md`.

The DynamoDB implementation is code-only in this phase. Its required future IAM scope is
`dynamodb:PutItem` on the existing table and `s3:PutObject` under `raw-events/*`; no infrastructure,
policy, production record, or deployment was changed.

## Exit criteria for phase 2

- written source authorization is attached to the adapter;
- exact session schedule source is authorized;
- recorder task can recover from forced disconnects without a duplicate or missing sequence;
- every raw batch is replayable and checksummed;
- checkpoint lag and source health are observable;
- the event ledger survives analytics rebuilds;
- a missed task can be backfilled from an authorized historical endpoint or recorded source export;
- cost alarms and an S3 lifecycle are configured;
- no raw timing redistribution endpoint exists.
