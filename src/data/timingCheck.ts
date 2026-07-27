import { timingCheckApiBaseUrl } from '../config/api.js';

export type TimingCheckSessionType = (
  'qualifying'
  | 'sprint_qualifying'
  | 'sprint_shootout'
  | 'sprint'
  | 'race'
);

export type TimingCheckStatus = (
  'idle'
  | 'checking'
  | 'queued'
  | 'cooldown'
  | 'limit_reached'
  | 'not_checked'
  | 'not_available'
  | 'available'
  | 'processing'
  | 'provisional'
  | 'up_to_date'
  | 'session_not_registered'
  | 'invalid_request'
  | 'error'
);

export interface TimingCheckResponse {
  status: TimingCheckStatus;
  message: string;
  checkedAt?: string | null;
  cooldownSeconds?: number;
  retryAfterSeconds?: number;
  checksRemaining?: number;
  current?: {
    status: TimingCheckStatus;
    message: string;
    checkedAt?: string | null;
  };
}

const decodeResponse = async (response: Response): Promise<TimingCheckResponse> => {
  const body = await response.json().catch(() => null) as TimingCheckResponse | null;
  if (body?.status && body.message) return body;
  if (response.status === 404) {
    throw new Error('Timing checks are not available in this environment yet.');
  }
  throw new Error(`Timing check service returned HTTP ${response.status}.`);
};

export const requestTimingCheck = async ({
  year,
  round,
  sessionType,
  signal,
}: {
  year: number;
  round: number;
  sessionType: TimingCheckSessionType;
  signal?: AbortSignal;
}) => {
  const response = await fetch(`${timingCheckApiBaseUrl}/api/v2/timing-checks`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ year, round, sessionType }),
    signal,
  });
  return decodeResponse(response);
};

export const getTimingCheckStatus = async ({
  year,
  round,
  sessionType,
  signal,
}: {
  year: number;
  round: number;
  sessionType: TimingCheckSessionType;
  signal?: AbortSignal;
}) => {
  const response = await fetch(
    `${timingCheckApiBaseUrl}/api/v2/timing-checks/${year}/${round}/${sessionType}`,
    {
      signal,
      headers: {
        accept: 'application/json',
      },
    },
  );
  return decodeResponse(response);
};
