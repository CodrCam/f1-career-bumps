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
- Ask Slipstream statistics search with editable filters and source-row evidence
- Official Formula1.com race result sync
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

The dashboard pages request the versioned `/api/v2` read models. Ask Slipstream
posts to `/api/v2/query`; if that new endpoint is not deployed yet, the browser
runs the identical deterministic query engine against the already-published
driver read model. Local JSON fallback is off by default so a missing data
backend is visible instead of silently showing stale data.

## Ask Slipstream

Ask Slipstream is a deterministic statistics search, not an AI service. It
parses supported driver-statistics questions into an allowlisted query,
calculates the result from published race rows, and displays its scope, formula,
timestamp, caveats, and evidence. Users can inspect and edit every interpreted
parameter before rerunning a calculation.

### Local environment keys

`.env.local` is the single functional local environment file. It contains:

- AWS access: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`,
  `DYNAMODB_TABLE`, and `CORS_ORIGIN`
- frontend routing: `VITE_API_BASE_URL` and `VITE_ALLOW_JSON_FALLBACK`
- ingestion overrides: `F1_RAW_DATA_BUCKET`, `F1_RAW_DATA_DIR`, and
  `FASTF1_PYTHON`

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

- Netlify: `VITE_API_BASE_URL` and `VITE_ALLOW_JSON_FALLBACK`
- GitHub/AWS: AWS credentials, data bucket, DynamoDB table, API CORS origin,
  and Lambda deployment variables

Both Netlify values are intentionally public build configuration. AWS
credentials and ingestion settings do not belong in Netlify.

---
*Private repository - Cameron Griffin*
