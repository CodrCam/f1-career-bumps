export const TIMING_ADAPTER_CONTRACT_VERSION = 2;

export const SOURCE_OPERATIONS = Object.freeze([
  'availabilityProbe',
  'sessionDiscovery',
  'liveIngestion',
  'historicalReplay',
  'rawStorage',
  'transformation',
  'publicDisplay',
]);

const requiredMethods = [
  'probeSessionAvailability',
  'discoverSessions',
  'streamLive',
  'replaySession',
  'getConnectionHealth',
];

const requireFunction = (adapter, method) => {
  if (typeof adapter?.[method] !== 'function') {
    throw new Error(`Timing source adapter "${adapter?.metadata?.id ?? 'unknown'}" is missing ${method}().`);
  }
};

export const defineTimingSourceAdapter = (adapter) => {
  if (!adapter?.metadata?.id || !adapter.metadata.schemaVersion) {
    throw new Error('Timing source adapters require an id and schema version.');
  }
  if (!adapter.metadata.attribution) {
    throw new Error(`Timing source adapter "${adapter.metadata.id}" requires source attribution.`);
  }
  if (!adapter.metadata.authorization?.status) {
    throw new Error(`Timing source adapter "${adapter.metadata.id}" requires authorization metadata.`);
  }

  requiredMethods.forEach((method) => requireFunction(adapter, method));

  return {
    ...adapter,
    contractVersion: TIMING_ADAPTER_CONTRACT_VERSION,
    metadata: {
      ...adapter.metadata,
      capabilities: [...(adapter.metadata.capabilities ?? [])],
      authorization: {
        operations: {},
        deploymentScopes: [],
        ...adapter.metadata.authorization,
      },
    },
  };
};

export const assertSourceOperationPermitted = (
  adapter,
  operation,
  {
    deploymentScope = 'development',
  } = {},
) => {
  if (!SOURCE_OPERATIONS.includes(operation)) {
    throw new Error(`Unknown timing source operation: ${operation}`);
  }

  const authorization = adapter?.metadata?.authorization;
  if (authorization?.status !== 'approved') {
    throw new Error(
      `Timing source "${adapter?.metadata?.id ?? 'unknown'}" has not been approved for use.`,
    );
  }
  if (authorization?.operations?.[operation] !== true) {
    throw new Error(
      `Timing source "${adapter?.metadata?.id ?? 'unknown'}" is not authorized for ${operation}.`,
    );
  }
  if (!authorization.deploymentScopes?.includes(deploymentScope)) {
    throw new Error(
      `Timing source "${adapter?.metadata?.id ?? 'unknown'}" is not authorized for the ${deploymentScope} deployment scope.`,
    );
  }
};

export const assertProductionSourceReady = (
  adapter,
  {
    requiredOperations = [
      'availabilityProbe',
      'sessionDiscovery',
      'liveIngestion',
      'rawStorage',
      'transformation',
    ],
  } = {},
) => {
  const authorization = adapter?.metadata?.authorization;
  requiredOperations.forEach((operation) => {
    assertSourceOperationPermitted(adapter, operation, { deploymentScope: 'production' });
  });

  const requiredEvidence = [
    'basis',
    'reviewedAt',
    'reviewedBy',
    'retentionPolicy',
    'publicDisplayPolicy',
  ];
  const missing = requiredEvidence.filter((field) => !authorization?.[field]);
  if (!authorization?.termsUrl && !authorization?.contractId) {
    missing.push('termsUrl or contractId');
  }
  if (missing.length) {
    throw new Error(
      `Timing source "${adapter?.metadata?.id ?? 'unknown'}" is missing production authorization evidence: ${missing.join(', ')}.`,
    );
  }
};

const wait = (milliseconds, signal) => new Promise((resolve, reject) => {
  const timeout = setTimeout(resolve, milliseconds);
  signal?.addEventListener('abort', () => {
    clearTimeout(timeout);
    reject(signal.reason ?? new Error('Timing source connection aborted.'));
  }, { once: true });
});

export async function* streamWithReconnect(
  adapter,
  session,
  {
    signal,
    cursor,
    maxAttempts = 6,
    initialDelayMs = 1_000,
    maximumDelayMs = 30_000,
    deploymentScope = 'development',
  } = {},
) {
  assertSourceOperationPermitted(adapter, 'liveIngestion', { deploymentScope });
  let attempt = 0;
  let currentCursor = cursor;

  while (!signal?.aborted && attempt < maxAttempts) {
    attempt += 1;
    try {
      for await (const message of adapter.streamLive(session, {
        signal,
        cursor: currentCursor,
      })) {
        currentCursor = message.cursor ?? message.sequence ?? currentCursor;
        attempt = 0;
        yield message;
      }
      return;
    } catch (error) {
      if (signal?.aborted) throw signal.reason ?? error;
      if (attempt >= maxAttempts) throw error;

      if (
        typeof adapter.renewAuthentication === 'function'
        && /401|403|auth|token/i.test(error.message)
      ) {
        await adapter.renewAuthentication({ signal });
      }

      const delay = Math.min(maximumDelayMs, initialDelayMs * (2 ** (attempt - 1)));
      await wait(delay, signal);
    }
  }
}
