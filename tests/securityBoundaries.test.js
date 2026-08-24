const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const test = require('node:test');

const SURVEY_PAYLOAD = {
  profile: { name: '보안경계검증', org: '현장' },
  incident: {
    scenarioRowId: 0,
    majorProcess: '마감공사',
    detailProcess: '마감공사',
    processContent: '천정도배',
    sentence: '전선의 피복 상태가 불량하여 감전될 수 있다.',
    riskType: '감전',
    triggers: [],
  },
};

let appServer;
let baseUrl;
let dataDir;
let fakeOpenAiServer;
let fakeOpenAiDelayMs = 0;
let serverModule;

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server.address()));
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeAllConnections();
  });
}

async function request(route, {
  body = {},
  cookie,
  forwardedFor = '198.51.100.1',
  requestId = randomUUID(),
  signal,
} = {}) {
  const headers = {
    'content-type': 'application/json',
    'x-forwarded-for': forwardedFor,
  };
  if (cookie) headers.cookie = cookie;
  if (requestId !== null) headers['x-request-id'] = requestId;
  const response = await fetch(`${baseUrl}${route}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: signal || AbortSignal.timeout(3_000),
  });
  const responseText = await response.text();
  return {
    response,
    json: responseText ? JSON.parse(responseText) : {},
  };
}

function sessionCookie(response) {
  return response.headers.get('set-cookie').split(';')[0];
}

async function createStartedSession(ip) {
  const submitted = await request('/api/submit', {
    body: SURVEY_PAYLOAD,
    forwardedFor: ip,
  });
  assert.equal(submitted.response.status, 200);
  const cookie = sessionCookie(submitted.response);
  const started = await request('/api/safer-start', { body: {}, cookie, forwardedFor: ip });
  assert.equal(started.response.status, 200);
  return cookie;
}

test.before(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'safer-security-boundaries-'));
  fakeOpenAiServer = http.createServer((req, res) => {
    req.resume();
    req.on('end', () => {
      setTimeout(() => {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({
          id: 'fake',
          object: 'chat.completion',
          choices: [{
            message: {
              role: 'assistant',
              content: JSON.stringify({ turn1: '하나', turn2: '둘', turn3: '셋' }),
            },
          }],
        }));
      }, fakeOpenAiDelayMs);
    });
  });
  const fakeAddress = await listen(fakeOpenAiServer);

  process.env.OPENAI_API_KEY = 'test-key';
  process.env.OPENAI_BASE_URL = `http://127.0.0.1:${fakeAddress.port}/v1`;
  process.env.OPENAI_TIMEOUT_MS = '1000';
  process.env.OPENAI_MAX_RETRIES = '0';
  process.env.SAFER_DATA_DIR = dataDir;
  process.env.FIELD_RATE_LIMIT_WINDOW_MS = '60000';
  process.env.SUBMIT_RATE_LIMIT_MAX_PER_IP = '2';
  process.env.SUBMIT_RATE_LIMIT_MAX_GLOBAL = '100';
  process.env.LLM_RATE_LIMIT_MAX_PER_IP = '2';
  process.env.LLM_RATE_LIMIT_MAX_GLOBAL = '100';
  process.env.LLM_CONCURRENCY_MAX = '1';
  delete process.env.DATABASE_URL;
  delete process.env.FIXED_CONDITION;
  delete process.env.REQUEST_LEASE_MS;

  serverModule = require('../server');
  await serverModule.ready;
  appServer = http.createServer(serverModule.app);
  const address = await listen(appServer);
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.after(async () => {
  await close(appServer);
  if (serverModule.close) await serverModule.close();
  await close(fakeOpenAiServer);
  fs.rmSync(dataDir, { recursive: true, force: true });
});

test('legacy write and LLM endpoints are unavailable from the field deployment', async () => {
  for (const route of [
    '/api/submit-followup',
    '/api/save-chat',
    '/api/generate',
    '/api/chat',
    '/api/context',
  ]) {
    const result = await request(route);
    assert.equal(result.response.status, 410, route);
    assert.deepEqual(result.json, { ok: false, error: 'legacy endpoint disabled' });
  }
});

test('request IDs are UUIDs or server-generated, and malformed values never reach persistence', async () => {
  const invalid = await request('/api/submit', {
    body: SURVEY_PAYLOAD,
    forwardedFor: '198.51.100.10',
    requestId: 'not-a-uuid',
  });
  assert.equal(invalid.response.status, 400);
  assert.deepEqual(invalid.json, { ok: false, error: 'X-Request-Id must be a UUID' });

  const oversized = await request('/api/submit', {
    body: SURVEY_PAYLOAD,
    forwardedFor: '198.51.100.11',
    requestId: 'x'.repeat(256),
  });
  assert.equal(oversized.response.status, 400);

  const generated = await request('/api/submit', {
    body: SURVEY_PAYLOAD,
    forwardedFor: '198.51.100.12',
    requestId: null,
  });
  assert.equal(generated.response.status, 200);
});

test('session bootstrap is bounded per client without blocking another tablet address', async () => {
  const ip = '198.51.100.20';
  const first = await request('/api/submit', { body: SURVEY_PAYLOAD, forwardedFor: ip });
  const second = await request('/api/submit', { body: SURVEY_PAYLOAD, forwardedFor: ip });
  const blocked = await request('/api/submit', { body: SURVEY_PAYLOAD, forwardedFor: ip });
  const anotherTablet = await request('/api/submit', {
    body: SURVEY_PAYLOAD,
    forwardedFor: '198.51.100.21',
  });

  assert.equal(first.response.status, 200);
  assert.equal(second.response.status, 200);
  assert.equal(blocked.response.status, 429);
  assert.equal(blocked.response.headers.has('retry-after'), true);
  assert.deepEqual(blocked.json, { ok: false, error: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' });
  assert.equal(anotherTablet.response.status, 200);
});

test('unexpected store errors are logged server-side but not returned to the participant', async () => {
  const originalCreateSession = serverModule.store.createSession.bind(serverModule.store);
  const originalConsoleError = console.error;
  const logged = [];
  serverModule.store.createSession = async () => {
    throw new Error('postgresql://internal-user:internal-password@private-host/safer');
  };
  console.error = (...args) => logged.push(args);
  try {
    const result = await request('/api/submit', {
      body: SURVEY_PAYLOAD,
      forwardedFor: '198.51.100.30',
    });
    assert.equal(result.response.status, 500);
    assert.equal(result.json.error, '요청을 처리하지 못했습니다. 같은 버튼으로 다시 시도해 주세요.');
    assert.match(result.json.errorId, /^[0-9a-f-]{36}$/i);
    assert.doesNotMatch(JSON.stringify(result.json), /internal-password|private-host|postgresql/i);
  } finally {
    serverModule.store.createSession = originalCreateSession;
    console.error = originalConsoleError;
  }
  assert.doesNotMatch(JSON.stringify(logged), /internal-password|private-host|postgresql/i);
});

test('authenticated LLM calls are rate-limited per field network', async () => {
  const cookies = await Promise.all([
    createStartedSession('198.51.100.40'),
    createStartedSession('198.51.100.41'),
    createStartedSession('198.51.100.42'),
  ]);
  const sharedFieldIp = '198.51.100.50';
  const first = await request('/api/safer-intro', {
    cookie: cookies[0], forwardedFor: sharedFieldIp, requestId: randomUUID(),
  });
  const second = await request('/api/safer-intro', {
    cookie: cookies[1], forwardedFor: sharedFieldIp, requestId: randomUUID(),
  });
  const blockedRequestId = randomUUID();
  const blocked = await request('/api/safer-intro', {
    cookie: cookies[2], forwardedFor: sharedFieldIp, requestId: blockedRequestId,
  });

  assert.equal(first.response.status, 200);
  assert.equal(second.response.status, 200);
  assert.equal(blocked.response.status, 429);
  const blockedSessionId = cookies[2].slice('safer_session='.length);
  assert.equal(
    serverModule.store.requests.get(`${blockedSessionId}:${blockedRequestId}`).status,
    'failed',
  );
});

test('only one admitted LLM operation runs when the global concurrency ceiling is reached', async () => {
  const firstCookie = await createStartedSession('198.51.100.60');
  const secondCookie = await createStartedSession('198.51.100.61');
  fakeOpenAiDelayMs = 200;
  try {
    const firstPromise = request('/api/safer-intro', {
      cookie: firstCookie,
      forwardedFor: '198.51.100.70',
      requestId: randomUUID(),
    });
    await new Promise((resolve) => setTimeout(resolve, 30));
    const blockedRequestId = randomUUID();
    const blocked = await request('/api/safer-intro', {
      cookie: secondCookie,
      forwardedFor: '198.51.100.71',
      requestId: blockedRequestId,
    });
    const first = await firstPromise;

    assert.equal(first.response.status, 200);
    assert.equal(blocked.response.status, 429);
    const blockedSessionId = secondCookie.slice('safer_session='.length);
    assert.equal(
      serverModule.store.requests.get(`${blockedSessionId}:${blockedRequestId}`).status,
      'failed',
    );
  } finally {
    fakeOpenAiDelayMs = 0;
  }
});

test('a disconnected tablet keeps its LLM concurrency slot until provider work finishes', async () => {
  const disconnectedCookie = await createStartedSession('198.51.100.80');
  const waitingCookie = await createStartedSession('198.51.100.81');
  const controller = new AbortController();
  const waitingRequestId = randomUUID();
  fakeOpenAiDelayMs = 200;

  try {
    const disconnectedResult = request('/api/safer-intro', {
      cookie: disconnectedCookie,
      forwardedFor: '198.51.100.82',
      requestId: randomUUID(),
      signal: controller.signal,
    }).then(
      () => null,
      (error) => error,
    );
    await new Promise((resolve) => setTimeout(resolve, 30));
    controller.abort();
    const disconnectedError = await disconnectedResult;
    assert.equal(disconnectedError?.name, 'AbortError');
    await new Promise((resolve) => setTimeout(resolve, 10));

    const blockedWhileProviderRuns = await request('/api/safer-intro', {
      cookie: waitingCookie,
      forwardedFor: '198.51.100.83',
      requestId: waitingRequestId,
    });
    assert.equal(blockedWhileProviderRuns.response.status, 429);

    await new Promise((resolve) => setTimeout(resolve, 220));
    const retry = await request('/api/safer-intro', {
      cookie: waitingCookie,
      forwardedFor: '198.51.100.83',
      requestId: waitingRequestId,
    });
    assert.equal(retry.response.status, 200);
  } finally {
    fakeOpenAiDelayMs = 0;
  }
});
