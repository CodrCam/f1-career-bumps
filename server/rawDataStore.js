import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const projectRoot = resolve(import.meta.dirname, '..');

const safeSegment = (value) => String(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');

const compactTimestamp = (value) => new Date(value)
  .toISOString()
  .replace(/[:.]/g, '-');

const getSnapshotKey = ({ year, round, source, timestamp, hash }) => {
  const roundSegment = `round-${String(round).padStart(2, '0')}`;
  return `raw/${year}/${roundSegment}/${safeSegment(source)}/${timestamp}-${hash}.json.gz`;
};

export const getRawDataStore = () => {
  const bucket = process.env.F1_RAW_DATA_BUCKET;
  const region = process.env.AWS_REGION ?? 'us-west-2';
  const localRoot = process.env.F1_RAW_DATA_DIR
    ? resolve(process.env.F1_RAW_DATA_DIR)
    : resolve(projectRoot, '.data');

  return {
    bucket,
    region,
    localRoot,
    client: bucket ? new S3Client({ region }) : null,
    mode: bucket ? 's3' : 'local',
  };
};

const putS3Object = async (store, key, body, metadata) => {
  await store.client.send(new PutObjectCommand({
    Bucket: store.bucket,
    Key: key,
    Body: body,
    ContentType: 'application/json',
    ContentEncoding: 'gzip',
    ServerSideEncryption: 'AES256',
    Metadata: metadata,
  }));
};

const writeLocalObject = async (store, key, body) => {
  const path = resolve(store.localRoot, key);
  await mkdir(resolve(path, '..'), { recursive: true });
  await writeFile(path, body);
  return path;
};

export const storeJsonSnapshot = async (data, {
  year,
  round,
  source,
  collectedAt = data?.collected_at ?? data?.updatedAt ?? new Date().toISOString(),
  store = getRawDataStore(),
} = {}) => {
  const json = JSON.stringify(data);
  const body = gzipSync(json, { level: 9 });
  const hash = createHash('sha256').update(json).digest('hex').slice(0, 16);
  const timestamp = compactTimestamp(collectedAt);
  const key = getSnapshotKey({ year, round, source, timestamp, hash });
  const latestKey = `raw/${year}/round-${String(round).padStart(2, '0')}/${safeSegment(source)}/latest.json.gz`;
  const metadata = {
    source: safeSegment(source),
    year: String(year),
    round: String(round),
    sha256: hash,
  };

  if (store.mode === 's3') {
    await putS3Object(store, key, body, metadata);
    await putS3Object(store, latestKey, body, metadata);

    return {
      mode: 's3',
      bucket: store.bucket,
      key,
      latest_key: latestKey,
      uri: `s3://${store.bucket}/${key}`,
      compressed_bytes: body.length,
      sha256: hash,
    };
  }

  const path = await writeLocalObject(store, key, body);
  const latestPath = await writeLocalObject(store, latestKey, body);

  return {
    mode: 'local',
    path,
    latest_path: latestPath,
    compressed_bytes: body.length,
    sha256: hash,
  };
};
