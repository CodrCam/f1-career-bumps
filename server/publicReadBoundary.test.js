import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

const projectFile = (path) => readFile(
  resolve(import.meta.dirname, '..', path),
  'utf8',
);

test('the public application has no ingestion trigger or queue permission', async () => {
  const [
    timingTemplate,
    raceDossier,
    frontendApiConfig,
    readApiPolicy,
  ] = await Promise.all([
    projectFile('aws/timing-recorder/template.yaml'),
    projectFile('src/pages/RaceDossier.tsx'),
    projectFile('src/config/api.js'),
    projectFile('aws/iam/f1website-api-read-runtime-policy.json'),
  ]);

  assert.doesNotMatch(timingTemplate, /PublicTimingCheck|POST \/api\/v2\/timing-checks/);
  assert.doesNotMatch(raceDossier, /TimingCheckControl|requestTimingCheck/);
  assert.doesNotMatch(frontendApiConfig, /TIMING_CHECK|timingCheckApi/);
  assert.doesNotMatch(readApiPolicy, /sqs:|ecs:RunTask/i);
});
