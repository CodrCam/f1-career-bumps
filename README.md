# Slipstream F1 Analytics

Slipstream is a Formula 1 data desk for following how championships, drivers,
race pace, pit work, and strategy change over a season.

Production site: [f1datadesktop.com](https://f1datadesktop.com)

## Quick Setup

Use Node.js 22 LTS (`.nvmrc`) so the Vite, Netlify, and lint toolchains all run
on a supported release.

The working local configuration is `.env.local`. It is intentionally ignored
by Git because it contains AWS credentials. The required key names are
documented below.

```bash
npm install
npm run env:check
npm run db:check:ddb
npm run dev:local
```

## Key Features
- Driver and constructor championship progression
- Driver statistics and head-to-head comparison
- Sector pace and consistency analysis
- Pit-stop service and full pit-lane timing
- Race stories built from overtakes, traffic, strategy, and attrition
- Fast site search across tools, races, drivers, and teams
- Official Formula1.com race result sync
- Automatic FastF1-to-OpenF1 timing fallback and missing-round retries
- Mobile-first responsive design

## Tech Stack
- React 19 + Vite
- Chart.js + official Formula1.com results
- AWS Lambda + API Gateway + DynamoDB for production
- Local Express/SQLite fallback while the AWS API is not wired in
- Netlify deployment

## Data Sources
- DynamoDB table `f1-website-data` - hosted 2025/2026 season records
- `f1_2025_season.json` - local 2025 seed/fallback data
- `Driver_Pitstop.json` - Pit stop analytics
- Formula1.com results pages - completed race, qualifying, sprint, and sprint qualifying updates

## Backend API

For local fallback testing, start the API server with:

```bash
npm run db:seed
npm run dev:api
```

The dashboard pages request the versioned `/api/v2` read models. Local JSON
fallback is off by default so a missing data backend is visible instead of
silently showing stale data. The header search is a client-side navigation
index; it adds no public write endpoint or metered service.

### Local environment keys

`.env.local` is the single functional local environment file. It contains:

- AWS access: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`,
  `DYNAMODB_TABLE`, and `CORS_ORIGIN`
- frontend routing: `VITE_API_BASE_URL` and `VITE_ALLOW_JSON_FALLBACK`
- ingestion overrides: `F1_RAW_DATA_BUCKET`, `F1_RAW_DATA_DIR`, and
  `FASTF1_PYTHON`
- fixture recorder state: `TIMING_RECORDER_DIR` (defaults to
  `.data/timing-recorder`)
- public timing-check API: `VITE_TIMING_CHECK_API_URL`

The scheduled `pipeline:refresh` task checks every completed official round,
repairs missing publication-status records, and retries up to two missing
analytics rounds per run. Detailed timing uses FastF1 first and OpenF1 as the
free historical fallback.

The next ingestion architecture is being developed against self-owned fixtures
until source storage and display rights are documented. Run the safe vertical
slice with:

```bash
npm run pipeline:fixture
```

It replays a synthetic timing stream through append-only compressed raw batches,
normalization, an idempotent race-event ledger, and pit-stop anomaly analysis.
It writes only below `.data/fixture-replay` and does not call a live source.
See [the race-ingestion ADR](docs/race-ingestion-adr.md) for the refresh audit,
source-authorization matrix, architecture, and phased rollout.

The production-shaped recorder control plane can also be rehearsed locally:

```bash
npm run timing:prepare:fixture
npm run timing:record:fixture
```

It adds a single-writer lease, durable cursor and health checkpoints, bounded
batch flushing, persistent local race events, disconnect recovery, and an
`already_complete` guard. With the local API running, recorder status is
available at `GET /api/v2/timing-recorder/sessions`; raw timing records and
credentials are never exposed by that endpoint. See the
[timing recorder runbook](docs/timing-recorder-runbook.md) for the rehearsal
workflow and contracted-provider onboarding gates.

Race dossiers also contain a rate-limited timing-check button. It can enqueue a
cheap source-availability probe, but it cannot launch AWS resources directly.
The backend enforces a per-session cooldown and a single dispatch reservation,
then starts one recorder only after an authorized source reports data.

Never expose AWS credentials through a `VITE_` variable. Vite embeds all
`VITE_` values in public browser code.

## AWS Backend Setup

The local environment file is already configured for this workspace. Check it
before accessing DynamoDB:

```bash
npm run env:check
npm run db:check:ddb
npm run db:update:f1 -- 2025 2026
```

The AWS Lambda handler in `aws/lambda/seasons.js` serves `/api/seasons/:year` and `/api/seasons/:year/summary` from DynamoDB.

Set the frontend environment variable to your AWS API base URL:

```bash
VITE_API_BASE_URL="https://your-api-id.execute-api.region.amazonaws.com"
```

See `AWS_SETUP.md` for the full user, IAM policy, database, Lambda, API Gateway, and environment checklist.

## Deployment

Pushing to the production branch triggers the Netlify frontend deployment and
the GitHub Actions AWS read-API deployment. Local `.env.local` values are not
uploaded. Configure production values in the relevant host:

- Netlify: `VITE_API_BASE_URL`, `VITE_TIMING_CHECK_API_URL`, and
  `VITE_ALLOW_JSON_FALLBACK`
- GitHub/AWS: AWS credentials, data bucket, DynamoDB table, API CORS origin,
  and Lambda deployment variables

Both Netlify values are intentionally public build configuration. AWS
credentials and ingestion settings do not belong in Netlify.

## License

The original software and documentation in this repository are licensed under
the [MIT License](LICENSE), Copyright (c) 2026 Cameron Griffin.

The MIT License covers the program itself. It does not grant rights to Formula
1 timing data, trademarks, logos, photographs, third-party datasets, or other
materials supplied under separate terms. Each data source must still be used
within its own authorization and license.
