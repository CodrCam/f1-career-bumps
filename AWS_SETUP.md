# AWS Backend Setup

This project uses a cost-first AWS backend:

- React/Vite frontend
- API Gateway route for `/api/seasons/{year}`
- Lambda handler at `aws/lambda/seasons.js`
- DynamoDB table for season data
- No always-on RDS instance

## Setup Order

1. Create or configure the AWS deploy identity.
2. Create/seed the DynamoDB table.
3. Deploy the Lambda.
4. Create API Gateway routes.
5. Set frontend `VITE_API_BASE_URL`.
6. Verify the API and frontend.
7. Add billing alerts.

## Current AWS Values

From the current AWS console setup:

- IAM user: `f1website`
- Application name: `f1-website`
- AWS region: `us-west-2`
- Application tag key: `awsApplication`
- DynamoDB table: `f1-website-data`
- Netlify project: `f1data2025`
- Netlify production URL: `https://f1datadesktop.com`

Use these names consistently:

```text
f1-website-api
f1-website-seasons
f1-website-data
f1-website-lambda-role
```

## Environment Variable Map

There are three different places for environment variables. Keeping them separate avoids most of the mess.

### Local `.env.local`

Used only by your laptop when running seed/check scripts, plus optional local frontend overrides.

```text
AWS_ACCESS_KEY_ID=your_local_iam_access_key
AWS_SECRET_ACCESS_KEY=your_local_iam_secret
AWS_REGION=us-west-2
DYNAMODB_TABLE=f1-website-data
F1_RAW_DATA_BUCKET=your-private-raw-data-bucket
VITE_API_BASE_URL=
VITE_ALLOW_JSON_FALLBACK=false
```

Do not put `CORS_ORIGIN` here unless you are specifically testing Lambda-style behavior locally. Do not commit `.env.local`.

### AWS Lambda Environment

Set these on the Lambda function:

```text
AWS_REGION=us-west-2
DYNAMODB_TABLE=f1-website-data
CORS_ORIGIN=https://f1datadesktop.com
```

Do not set `AWS_ACCESS_KEY_ID` or `AWS_SECRET_ACCESS_KEY` on Lambda. Lambda should use its execution role.

### Netlify Environment

Set this on the Netlify project after API Gateway exists:

```text
VITE_API_BASE_URL=https://your-api-id.execute-api.us-west-2.amazonaws.com
```

Do not put AWS access keys, `DYNAMODB_TABLE`, or `CORS_ORIGIN` in Netlify. The frontend only needs the public API base URL.

## 1. Why DynamoDB

DynamoDB is the better default for this project because it avoids an always-running database bill. The app mostly reads compact season records for 2025 and 2026, so DynamoDB can stay very cheap while still giving us a real hosted data store.

The production architecture is:

```text
Frontend -> API Gateway -> Lambda -> DynamoDB
```

Local development can still use:

```text
Frontend -> Vite proxy -> local Express -> local SQLite seed DB
```

## 2. DynamoDB Data Model

One table:

```text
f1-website-data
```

Primary key:

```text
pk string
sk string
```

Items:

```text
pk=SEASON#2025, sk=META
pk=SEASON#2025, sk=RACE#01
pk=SEASON#2025, sk=RACE#02
...
```

The metadata item powers:

```text
GET /api/seasons/2025/summary
```

The race items power:

```text
GET /api/seasons/2025
```

The same pattern is used for 2026:

```text
pk=SEASON#2026, sk=META
pk=SEASON#2026, sk=RACE#01
pk=SEASON#2026, sk=ANALYTICS#ROUND#01
pk=RACE#2026#01, sk=ANALYTICS#META
pk=RACE#2026#01, sk=ANALYTICS#STORY
pk=RACE#2026#01, sk=DRIVER#RUS
```

The 2026 Race Story feature uses a race partition for its overtake events, traffic encounters, pit cycles, attrition, disruption, and driver metrics. A compact season index powers the circuit transfer map without scanning the table.

## 3. AWS Identity

Use the root account only for account-level setup. For normal work, use IAM Identity Center or the `f1website` IAM user with MFA.

For early development, the deploy identity needs access to:

- Lambda
- API Gateway
- DynamoDB
- CloudWatch Logs
- IAM role creation/pass-role

This repo includes a starter development policy:

```text
aws/iam/f1website-deploy-starter-policy.json
```

Attach it to `f1website` only if that user is acting as the deploy/admin user for this app. It is intentionally broad for initial setup and should be tightened once the final resource ARNs exist.

If you only want to seed/check DynamoDB from your laptop, use the smaller inline policy:

```text
aws/iam/f1website-dynamodb-seed-policy.json
```

Attach it here:

```text
IAM -> Users -> f1website -> Permissions -> Add permissions -> Create inline policy -> JSON
```

Useful AWS-managed policies while prototyping:

```text
AWSLambda_FullAccess
AmazonAPIGatewayAdministrator
AmazonDynamoDBFullAccess
CloudWatchLogsFullAccess
```

Avoid leaving broad policies attached permanently.

## 4. Create And Seed DynamoDB

You do not need the AWS CLI installed to seed from this repo. The Node scripts can read local credentials from `.env.local`.

Create `.env.local` from the example:

```bash
cp .env.local.example .env.local
```

Fill in:

```text
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-west-2
DYNAMODB_TABLE=f1-website-data
```

Do not commit `.env.local`. It is ignored by git.

Check access before writing data:

```bash
npm run env:check
npm run db:check:ddb
```

If the table exists but is empty, the check will say `seeded: false`.

The seed script creates the table if it does not exist, using on-demand/pay-per-request billing:

```bash
npm run db:seed:ddb
```

Expected output currently looks like:

```json
{
  "table": "f1-website-data",
  "region": "us-west-2",
  "year": 2025,
  "rounds": 12,
  "results": 559,
  "items": 13
}
```

The script seeds from:

```text
src/data/f1_2025_season.json
```

For current completed race results, use Formula1.com instead of the static seed:

```bash
npm run db:update:f1 -- 2025 2026
```

## 5. Lambda

Handler file:

```text
aws/lambda/seasons.js
```

Shared DynamoDB reader:

```text
aws/lambda/dynamoSeasonData.js
```

Automatic updater handler:

```text
aws/lambda/updateSeason.js
```

The handler supports:

```text
GET /api/seasons/2025
GET /api/seasons/2025/summary
GET /api/seasons/2026/analytics
GET /api/seasons/2026/races/9/analytics
OPTIONS preflight
```

The same handler supports other year values, including 2026, once those DynamoDB items exist.

Backend environment variables:

```text
AWS_REGION=us-west-2
DYNAMODB_TABLE=f1-website-data
CORS_ORIGIN=https://f1datadesktop.com
```

Use `CORS_ORIGIN=*` only for quick testing. For production, set it to the actual frontend domain.

## 6. Lambda Execution Role

The Lambda execution role needs:

- CloudWatch logging
- Read access to the DynamoDB table

Minimum DynamoDB actions for the Lambda runtime:

```text
dynamodb:GetItem
dynamodb:Query
```

Resource:

```text
arn:aws:dynamodb:us-west-2:<account-id>:table/f1-website-data
```

AWS managed policy for logs:

```text
AWSLambdaBasicExecutionRole
```

If you deploy `aws/lambda/updateSeason.js` for scheduled post-race refreshes, that Lambda also needs:

```text
dynamodb:BatchWriteItem
dynamodb:DeleteItem
dynamodb:PutItem
dynamodb:Query
```

Run it from EventBridge on a simple schedule, such as every Monday during the season, or daily if you want it to quietly pick up newly published results.

The update Lambda policy is committed here:

```text
aws/iam/f1website-dynamodb-update-lambda-policy.json
```

The complete 2026 timing pipeline runs from `.github/workflows/update-race-data.yml` each Monday and Tuesday after a race. It assumes an AWS role through GitHub OIDC, so GitHub does not store permanent AWS access keys.

Use these IAM templates:

```text
aws/iam/github-actions-trust-policy.json
aws/iam/f1website-race-pipeline-policy.json
```

Replace the placeholders, attach the permissions policy to the update role, then set:

```text
GitHub secret: AWS_UPDATE_ROLE_ARN
GitHub variable: DYNAMODB_TABLE=f1-website-data
GitHub variable: F1_RAW_DATA_BUCKET=<private-bucket-name>
```

## 7. API Gateway

Create HTTP API routes that invoke the Lambda:

```text
GET /api/seasons/{year}
GET /api/seasons/{year}/{view}
GET /api/seasons/{year}/races/{round}/analytics
OPTIONS /api/seasons/{year}
OPTIONS /api/seasons/{year}/{view}
OPTIONS /api/seasons/{year}/races/{round}/analytics
```

The Lambda already handles CORS response headers, including preflight. If you enable API Gateway-managed CORS too, keep the origins/methods aligned:

```text
Origin: your frontend domain
Methods: GET, OPTIONS
Headers: content-type
```

For `us-west-2`, the frontend API base URL will look like:

```text
https://your-api-id.execute-api.us-west-2.amazonaws.com
```

## 8. Frontend Env

The frontend uses:

```text
VITE_API_BASE_URL=https://your-api-id.execute-api.us-west-2.amazonaws.com
```

The React hook in `src/hooks/useSeasonData.js` calls:

```text
${VITE_API_BASE_URL}/api/seasons/:year
```

If `VITE_API_BASE_URL` is blank in local dev, Vite proxies `/api` to the local Express backend at `http://localhost:3001`.

## 9. Local Dev

Local backend and frontend together:

```bash
npm run dev:local
```

This starts the local API on port `3001` and Vite on port `5173`. With AWS credentials and `DYNAMODB_TABLE` in `.env.local`, the local API reads DynamoDB. If you only run `npm run dev`, the browser can load the page but `/api/seasons/:year` will not have a backend to answer it.

Local backend only:

```bash
npm run db:seed
npm run dev:api
```

Local frontend only:

```bash
npm run dev
```

Only enable `VITE_ALLOW_JSON_FALLBACK=true` when you intentionally want offline 2025 seed data. Leave it false/blank while validating the real database route.

Local endpoints:

```text
http://localhost:3001/api/seasons/2025
http://localhost:3001/api/seasons/2025/summary
http://localhost:3001/api/seasons/2026
http://localhost:3001/api/seasons/2026/analytics
http://localhost:3001/api/seasons/2026/races/9/analytics
```

## 10. Verification

AWS seed:

```bash
npm run db:check:ddb
npm run db:seed:ddb
npm run db:check:ddb
```

Formula1.com refresh for multiple seasons:

```bash
npm run db:update:f1 -- 2025 2026
npm run db:check:ddb -- 2026
```

Build the validated 2026 Race Story dataset:

```bash
npm run timing:setup
npm run pipeline:backfill -- --year 2026 --no-dynamo
```

Refresh only the latest completed 2026 race:

```bash
npm run pipeline:update -- --year 2026
```

AWS API checks:

```bash
curl https://your-api-id.execute-api.us-west-2.amazonaws.com/api/seasons/2025/summary
curl https://your-api-id.execute-api.us-west-2.amazonaws.com/api/seasons/2025
curl https://your-api-id.execute-api.us-west-2.amazonaws.com/api/seasons/2026/analytics
curl https://your-api-id.execute-api.us-west-2.amazonaws.com/api/seasons/2026/races/9/analytics
```

Expected summary shape:

```json
{
  "year": 2026,
  "rounds": 0,
  "results": 0
}
```

Frontend build:

```bash
npm run build
```

## 11. Cost Guardrails

Do these before sharing the app:

- Create an AWS Budget alert for a low amount, such as `$5` or `$10`.
- Use DynamoDB on-demand billing for simple pay-per-use.
- Do not enable DynamoDB backups, streams, global tables, DAX, or extra replicas until needed.
- Use API Gateway HTTP API, not REST API, unless a REST-only feature is required.
- Do not enable Lambda provisioned concurrency.
- Keep CloudWatch log retention short, such as 7 or 14 days.
- Keep the raw snapshot S3 bucket private and use a lifecycle rule if history grows.
- The 2026 update workflow runs only twice per race week and keeps no server running.

## Current Repo Files

```text
aws/lambda/seasons.js
aws/lambda/dynamoSeasonData.js
aws/lambda/updateSeason.js
aws/lambda/formula1SeasonBuilder.js
aws/lambda/dynamoSeasonWriter.js
aws/iam/f1website-deploy-starter-policy.json
aws/iam/f1website-race-pipeline-policy.json
aws/iam/github-actions-trust-policy.json
server/seedDynamoDb.js
server/updateDynamoFromFormula1.js
server/updateRacePipeline.js
server/backfillRaceAnalytics.js
server/formula1SeasonBuilder.js
server/dynamoSeasonWriter.js
src/hooks/useSeasonData.js
src/hooks/useRaceStoryData.js
.env.example
```
