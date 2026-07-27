import { existsSync, readFileSync } from 'node:fs';

const localEnvPath = '.env.local';
const localRequired = [
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_REGION',
  'DYNAMODB_TABLE',
];

const parseEnvFile = (filePath) => {
  if (!existsSync(filePath)) {
    return { exists: false, keys: [], counts: {}, empty: new Set() };
  }

  const keys = [];
  const counts = {};
  const empty = new Set();
  const lines = readFileSync(filePath, 'utf8').split(/\r?\n/);

  lines.forEach((line, index) => {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) return;

    const [, key, value] = match;
    keys.push({ key, line: index + 1 });
    counts[key] = (counts[key] ?? 0) + 1;
    if (!value.trim()) empty.add(key);
  });

  return { exists: true, keys, counts, empty };
};

const env = parseEnvFile(localEnvPath);

if (!env.exists) {
  console.log('.env.local is missing. Create it using the key list in README.md.');
  process.exit(1);
}

const duplicates = Object.entries(env.counts)
  .filter(([, count]) => count > 1)
  .map(([key]) => key);

const missing = localRequired.filter((key) => !env.counts[key]);
const emptyRequired = localRequired.filter((key) => env.empty.has(key));

console.log(JSON.stringify({
  file: localEnvPath,
  ok: duplicates.length === 0
    && missing.length === 0
    && emptyRequired.length === 0,
  keys: env.keys.map(({ key, line }) => ({ key, line })),
  duplicates,
  missing,
  emptyRequired,
  expectedLocalOnlyKeys: [
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
    'AWS_SESSION_TOKEN',
    'AWS_REGION',
    'DYNAMODB_TABLE',
    'VITE_API_BASE_URL',
    'VITE_TIMING_CHECK_API_URL',
    'VITE_ALLOW_JSON_FALLBACK',
    'F1_RAW_DATA_BUCKET',
    'F1_RAW_DATA_DIR',
    'FASTF1_PYTHON',
  ],
}, null, 2));

if (duplicates.length || missing.length || emptyRequired.length) {
  process.exit(1);
}
