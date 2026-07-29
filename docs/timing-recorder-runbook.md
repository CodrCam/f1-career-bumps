# Timing recorder runbook

Status: fixture rehearsal available; live source adapter not yet authorized  
Last updated: 2026-07-27

## What is available now

The timing recorder can be prepared before a session, claim a single-writer lease, consume a live
adapter stream, flush immutable compressed raw batches, normalize records into the append-only event
ledger, persist checkpoints and health, and resume after an interrupted stream.

The included adapter is a self-owned synthetic fixture. It exercises the same recorder boundary a
contracted feed will use, but it does not connect to Formula 1, FastF1, OpenF1, DHL, or another live
source.

## Local rehearsal

Use Node.js 22 and prepare the synthetic session:

```bash
npm run timing:prepare:fixture
```

This creates a scheduled recorder state below `.data/timing-recorder`. Run the recording:

```bash
npm run timing:record:fixture
```

The fixture is split into batches of ten by default. A completed rerun returns
`already_complete` without rewriting the session. To rehearse a visibly paced stream or change the
batch size:

```bash
npm run timing:record:fixture -- --delay 100 --batch-size 5
```

For an isolated rehearsal, select a different output directory:

```bash
npm run timing:record:fixture -- --output /private/tmp/slipstream-recorder
```

Exercise the same check-before-launch decision used by the queue worker:

```bash
npm run timing:check:fixture
```

The first check sees the fixture, reserves one dispatch, and records it. A second check does not
launch duplicate work; it reports that the unchanged provisional classification should be checked
again later.

## Recorder status access

Start the local API:

```bash
npm run dev:api
```

Then inspect all recorder sessions:

```text
GET http://localhost:3001/api/v2/timing-recorder/sessions
```

Filter to one source:

```text
GET http://localhost:3001/api/v2/timing-recorder/sessions?source=slipstream-fixture
```

The response contains schedule identity, status, attempt count, checkpoint cursor, batch/message
counts, source availability, connection health, and the last error. It intentionally omits raw
records, raw object URIs, credentials, and provider secrets.

Set `TIMING_RECORDER_DIR` if the recorder and local API should share a state root other than
`.data/timing-recorder`.

## Local artifact layout

```text
.data/timing-recorder/
  state/{source}/{session}.json
  raw-events/{year}/round-NN/{session}/{source}/batch-*.jsonl.gz
  race-events/{year}/round-NN/{session}/{event-id}.json
```

Local state coordination is for a single development host. Production coordination uses the
conditional DynamoDB state-store implementation so only one task owns a non-expired session lease.

## Private check queue and operator trigger

The AWS foundation in `aws/timing-recorder/template.yaml` defines:

- an SQS ingestion-check queue and dead-letter queue;
- a low-concurrency dispatcher that probes availability and starts Fargate only after a positive
  probe;
- a five-minute dispatch reservation, preventing two queue messages from launching two tasks;
- a one-time EventBridge Scheduler group for pre-created post-session checks.

There is deliberately no public HTTP route to this queue and no frontend refresh button. Only
EventBridge Scheduler and authenticated operators may enqueue checks. The read API has no IAM
permission to send SQS messages or start ECS tasks.

To create a manual queue message:

```bash
npm run timing:check:request -- \
  --source licensed-provider \
  --session 2026-01-R \
  --requester cameron
```

Send that JSON to the `IngestionCheckQueueUrl` CloudFormation output. The queue consumer returns a
negative check for retry, acknowledges an up-to-date final classification, or reserves and launches
one recorder task.

To encode checks weeks ahead, create a session plan with an explicit `checkAt` for each qualifying,
sprint, or race session, then generate deterministic one-time Scheduler payloads:

```bash
npm run timing:check:schedules -- \
  --plan server/fixtures/timing/session-check-plan.example.json \
  --queue-arn QUEUE_ARN \
  --role-arn CHECK_SCHEDULER_ROLE_ARN \
  --group SCHEDULE_GROUP
```

No default “race end plus N minutes” is guessed. The plan chooses the first check time; SQS retries
negative probes every five minutes for up to roughly five hours before moving an unprocessable
message to the dead-letter queue. A later manual or reconciliation check can still detect revisions.

## Read-only frontend boundary

Race dossiers show publication state but cannot request an ingestion check. The timing-recorder
stack creates no public timing-check Lambda, API Gateway route, or browser-facing queue permission.
Any previously deployed version of those resources must be removed by updating the CloudFormation
stack to this template.

Observed FIA publication records demonstrate why the system must distinguish availability from
finality. For the 2026 Barcelona-Catalunya event, the FIA list shows a provisional race
classification at 16:56 CET and the final classification at 19:50 CET. The 2026 Monaco record also
shows a revised final classification several days after the original. See the
[FIA decision-document index](https://www.fia.com/documents/championships) and
[Monaco event documents](https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2026-2072/event/Monaco%20Grand%20Prix).

## Contracted provider onboarding

A live adapter cannot be enabled merely by adding a URL or token. Before production use, its
metadata must include:

- authorization status `approved`;
- a production deployment scope;
- contract or terms identifier;
- authorization basis, reviewer, and review date;
- retention and public-display policies;
- explicit permission for session discovery, live ingestion, raw storage, transformation, and any
  public display.

The adapter must implement `discoverSessions`, `streamLive`, `replaySession`, and
`getConnectionHealth`. Authentication renewal is optional but supported. Credentials remain in the
runtime secret store and must never be written to recorder state, raw-object metadata, logs, or
frontend configuration.

Provider message mapping must produce a stable source event id, session id, positive sequence,
event timestamp, and source cursor. A provider adapter is not complete until forced disconnect,
expired-token, duplicate-delivery, missing-sequence, and end-of-session behavior have fixture tests.

## Pre-event timeline

- **Four weeks before:** attach authorization evidence, map the provider schema, and import/discover
  the session schedule.
- **Two weeks before:** run fixture and recorded-provider-sample replays; verify every raw batch can
  be replayed.
- **One week before:** create one-time session task schedules, verify secrets/IAM, and test alarms.
- **One day before:** confirm schedule times, task image digest, source health, storage lifecycle,
  and cost alarm.
- **During the session:** monitor lease owner, checkpoint age, source health, message rate, sequence
  gaps, reconnect count, and raw-batch age.
- **After the session:** enqueue an availability check, ingest a provisional classification when
  permitted, continue checking for final/corrected classifications, verify checksums and coverage,
  replay materializations, and keep editorial publication disabled until comparison checks pass.

## Production work still required

The source-specific adapter, provider secret value, built container/Lambda artifacts, created
one-time schedules, alarms, and S3 lifecycle configuration still depend on the selected provider
contract and AWS account topology. The CloudFormation, Dockerfile, Lambda handlers, and schedule
payload generator are code-only; no AWS resource was created or changed by this buildout.
