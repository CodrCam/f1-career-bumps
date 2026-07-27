import { createHash, randomUUID } from 'node:crypto';
import {
  link,
  mkdir,
  open,
  readFile,
  unlink,
} from 'node:fs/promises';
import { resolve } from 'node:path';
import { gzipSync, gunzipSync } from 'node:zlib';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const safeSegment = (value) => String(value ?? 'unknown')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');

const batchKey = ({ session, source, firstSequence, lastSequence, hash }) => (
  [
    'raw-events',
    session.year,
    `round-${String(session.round).padStart(2, '0')}`,
    safeSegment(session.type),
    safeSegment(source),
    `batch-${String(firstSequence).padStart(8, '0')}-${String(lastSequence).padStart(8, '0')}-${hash}.jsonl.gz`,
  ].join('/')
);

const writeLocalOnce = async (path, body) => {
  await mkdir(resolve(path, '..'), { recursive: true });
  const temporaryPath = `${path}.${randomUUID()}.tmp`;
  let handle;

  try {
    handle = await open(temporaryPath, 'wx');
    await handle.writeFile(body);
    await handle.sync();
    await handle.close();
    handle = null;

    try {
      await link(temporaryPath, path);
      return 'stored';
    } catch (error) {
      if (error.code === 'EEXIST') return 'existing';
      throw error;
    }
  } catch (error) {
    throw error;
  } finally {
    await handle?.close();
    await unlink(temporaryPath).catch((error) => {
      if (error.code !== 'ENOENT') throw error;
    });
  }
};

const writeS3Once = async (store, key, body, metadata) => {
  try {
    await store.client.send(new PutObjectCommand({
      Bucket: store.bucket,
      Key: key,
      Body: body,
      ContentType: 'application/x-ndjson',
      ContentEncoding: 'gzip',
      ServerSideEncryption: 'AES256',
      IfNoneMatch: '*',
      Metadata: metadata,
    }));
    return 'stored';
  } catch (error) {
    if (
      error.name === 'PreconditionFailed'
      || [409, 412].includes(error.$metadata?.httpStatusCode)
    ) {
      return 'existing';
    }
    throw error;
  }
};

export const createRawEventLogStore = ({
  bucket = process.env.F1_RAW_DATA_BUCKET,
  region = process.env.AWS_REGION ?? 'us-west-2',
  localRoot = resolve(import.meta.dirname, '../.data'),
  client,
} = {}) => ({
  bucket,
  region,
  localRoot: resolve(localRoot),
  client: bucket ? (client ?? new S3Client({ region })) : null,
  mode: bucket ? 's3' : 'local',
});

export const storeRawEventBatch = async (
  store,
  messages,
  {
    session,
    source,
    sourceSchemaVersion,
  } = {},
) => {
  if (!messages?.length) throw new Error('Raw event batches cannot be empty.');
  messages.forEach((message, index) => {
    if (!message?.id || !Number.isInteger(Number(message.sequence))) {
      throw new Error(`Raw event at batch index ${index} requires an id and whole-number sequence.`);
    }
    if (message.session_id !== session.id) {
      throw new Error(`Raw event "${message.id}" does not belong to session "${session.id}".`);
    }
    if (index > 0 && Number(message.sequence) <= Number(messages[index - 1].sequence)) {
      throw new Error('Raw event batch sequences must be strictly increasing.');
    }
  });

  const jsonl = `${messages.map((message) => JSON.stringify(message)).join('\n')}\n`;
  const hash = createHash('sha256').update(jsonl).digest('hex');
  const body = gzipSync(jsonl, { level: 9 });
  const firstSequence = Number(messages[0].sequence);
  const lastSequence = Number(messages.at(-1).sequence);
  const key = batchKey({
    session,
    source,
    firstSequence,
    lastSequence,
    hash: hash.slice(0, 16),
  });
  const metadata = {
    source: safeSegment(source),
    schema: String(sourceSchemaVersion),
    session: safeSegment(session.id),
    sha256: hash,
  };
  const status = store.mode === 's3'
    ? await writeS3Once(store, key, body, metadata)
    : await writeLocalOnce(resolve(store.localRoot, key), body);

  return {
    mode: store.mode,
    status,
    key,
    uri: store.mode === 's3'
      ? `s3://${store.bucket}/${key}`
      : resolve(store.localRoot, key),
    firstSequence,
    lastSequence,
    records: messages.length,
    compressedBytes: body.length,
    sha256: hash,
  };
};

export const readLocalRawEventBatch = async (store, key) => {
  if (store.mode !== 'local') throw new Error('Local raw event reads require a local store.');
  const body = await readFile(resolve(store.localRoot, key));
  return gunzipSync(body)
    .toString('utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
};
