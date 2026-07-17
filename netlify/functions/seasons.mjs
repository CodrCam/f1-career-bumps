const runtimeEnvKeys = [
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_SESSION_TOKEN',
  'AWS_REGION',
  'DYNAMODB_TABLE',
];

const prepareAwsEnvironment = () => {
  runtimeEnvKeys.forEach((key) => {
    const value = globalThis.Netlify?.env?.get(key);
    if (value) process.env[key] = value;
  });
};

const jsonResponse = (status, body, headers = {}) => new Response(
  JSON.stringify(body),
  {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=30, stale-while-revalidate=300',
      ...headers,
    },
  },
);

export default async (request) => {
  if (request.method !== 'GET') {
    return jsonResponse(405, { error: 'Method not allowed' }, {
      Allow: 'GET',
    });
  }

  prepareAwsEnvironment();

  const { pathname } = new URL(request.url);
  if (pathname === '/api/health') {
    return jsonResponse(200, {
      ok: true,
      dataSource: 'dynamodb',
    });
  }

  const { handler } = await import('../../aws/lambda/seasons.js');
  const result = await handler({
    rawPath: pathname,
    requestContext: {
      http: {
        method: request.method,
      },
    },
  });

  return new Response(result.body, {
    status: result.statusCode,
    headers: {
      ...result.headers,
      'Cache-Control': result.statusCode === 200
        ? 'public, max-age=30, stale-while-revalidate=300'
        : 'no-store',
    },
  });
};

export const config = {
  path: [
    '/api/health',
    '/api/seasons/:year',
    '/api/seasons/:year/:view',
    '/api/seasons/:year/races/:round/analytics',
  ],
};
