# F1 Performance Dashboard

Personal F1 analytics platform with race results, season standings, pit stop trend forecasts, and live telemetry.

## Quick Setup

```bash
npm install
npm run env:check
npm run db:check:ddb
npm run dev:local
```

## Key Features
- Pit stop trend forecasting
- Official Formula1.com race result sync
- Precision timing analysis
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

The dashboard pages request `/api/seasons/:year`. Local JSON fallback is off by default so a missing backend is visible instead of silently showing stale data.

## AWS Backend Setup

Create/check the DynamoDB table for the AWS backend:

```bash
cp .env.local.example .env.local
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
Auto-deploys to Netlify on every push to main branch.

---
*Private repository - Cameron Griffin*
