import { execFile } from 'node:child_process';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const projectRoot = resolve(import.meta.dirname, '..');
const snapshotScript = resolve(projectRoot, 'ingestion/fastf1_snapshot.py');

const canAccess = async (path) => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

export const resolveFastF1Python = async () => {
  const candidates = [
    process.env.FASTF1_PYTHON,
    resolve(projectRoot, '.venv/bin/python'),
    'python3',
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (!candidate.includes('/') || await canAccess(candidate)) return candidate;
  }

  return 'python3';
};

const formatFastF1Error = (error) => {
  const details = [error.stderr, error.stdout, error.message]
    .filter(Boolean)
    .join('\n')
    .trim();

  if (/No module named ['"]fastf1['"]/i.test(details)) {
    return new Error(
      'FastF1 is not installed. Run "npm run timing:setup" once, then retry the update.',
    );
  }

  return new Error(`FastF1 timing collection failed: ${details}`);
};

export const collectFastF1Snapshot = async ({
  year,
  round,
  session = 'R',
  includeTelemetry = false,
  timeoutMs = 12 * 60 * 1000,
} = {}) => {
  const tempDirectory = await mkdtemp(join(tmpdir(), 'slipstream-fastf1-'));
  const outputPath = join(tempDirectory, 'snapshot.json');
  const python = await resolveFastF1Python();
  const args = [
    snapshotScript,
    '--year',
    String(year),
    '--round',
    String(round),
    '--session',
    session,
    '--output',
    outputPath,
    '--cache',
    resolve(projectRoot, '.cache/fastf1'),
  ];

  if (includeTelemetry) args.push('--telemetry');

  try {
    await execFileAsync(python, args, {
      cwd: projectRoot,
      maxBuffer: 10 * 1024 * 1024,
      timeout: timeoutMs,
    });

    return JSON.parse(await readFile(outputPath, 'utf8'));
  } catch (error) {
    throw formatFastF1Error(error);
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
};
