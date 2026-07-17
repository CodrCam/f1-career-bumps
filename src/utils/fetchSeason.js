const wait = (delayMs, signal) => new Promise((resolve, reject) => {
  const timeout = setTimeout(resolve, delayMs);

  signal?.addEventListener('abort', () => {
    clearTimeout(timeout);
    reject(new DOMException('Request cancelled', 'AbortError'));
  }, { once: true });
});

export const fetchSeason = async ({
  url,
  signal,
  fetchImpl = fetch,
  attempts = 3,
  retryDelayMs = 300,
}) => {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        cache: 'no-store',
        signal,
      });

      if (!response.ok) {
        throw new Error(`Season API returned ${response.status}`);
      }

      const data = await response.json();
      if (!data || !Array.isArray(data.races) || data.races.length === 0) {
        throw new Error('Season API returned no races');
      }

      return data;
    } catch (error) {
      if (error?.name === 'AbortError') throw error;
      lastError = error;

      if (attempt < attempts) {
        await wait(retryDelayMs * attempt, signal);
      }
    }
  }

  throw lastError;
};
