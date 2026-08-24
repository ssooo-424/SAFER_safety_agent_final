const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[4-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SURVEY_PAYLOAD = {
  participantId: 'client-controlled-id',
  profile: { name: '동일이름', org: '동일소속' },
  incident: {
    scenarioRowId: 0,
    majorProcess: '마감공사',
    detailProcess: '마감공사',
    processContent: '천정도배',
    sentence: '작업자가 천정도배 작업을 위해 전선을 사용하고 있다. 전선의 피복 상태가 불량하여 노출된 부분에 손이 닿는 순간 감전된다.',
    riskType: '감전',
    triggers: [],
  },
};

let appServer;
let fakeOpenAiServer;
let baseUrl;
let dataDir;
let serverModule;
let fakeFailuresRemaining = 0;

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

async function request(route, { method = 'GET', body, cookie, requestId, forwardedProto } = {}) {
  const headers = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (cookie) headers.cookie = cookie;
  if (requestId) headers['x-request-id'] = stableRequestId(requestId);
  if (forwardedProto) headers['x-forwarded-proto'] = forwardedProto;
  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(2000),
  });
  return { response, json: await response.json() };
}

function stableRequestId(label) {
  const hex = createHash('sha256').update(String(label)).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function sessionCookie(response) {
  return response.headers.get('set-cookie').split(';')[0];
}

function sessionToken(response) {
  return sessionCookie(response).slice('safer_session='.length);
}

async function completeConversation(submitted, prefix) {
  const cookie = sessionCookie(submitted.response);
  await request('/api/safer-start', { method: 'POST', body: {}, cookie, requestId: `${prefix}-start` });
  await request('/api/safer-intro', { method: 'POST', body: {}, cookie, requestId: `${prefix}-intro` });
  await request('/api/safer-chat', { method: 'POST', body: { turn: 4 }, cookie, requestId: `${prefix}-turn4` });
  await request('/api/safer-chat', { method: 'POST', body: { turn: 5, userMessage: '안전수칙 답변' }, cookie, requestId: `${prefix}-turn5` });
  await request('/api/safer-chat', { method: 'POST', body: { turn: 6 }, cookie, requestId: `${prefix}-turn6` });
  return cookie;
}

test.before(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'safer-session-http-'));
  fakeOpenAiServer = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', () => {
      if (fakeFailuresRemaining > 0) {
        fakeFailuresRemaining -= 1;
        res.writeHead(500, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: { message: 'temporary fake failure' } }));
        return;
      }
      const payload = JSON.parse(raw);
      const isEvaluation = payload.temperature === 0;
      const content = isEvaluation
        ? JSON.stringify({ coverage: [1, 2, 3].map((ruleId) => ({ rule_id: ruleId, status: 'covered', acknowledgement: '확인', summary: '요약', evidence: '답변' })) })
        : JSON.stringify({ turn1: 'intro one', turn2: 'intro two', turn3: 'intro three' });
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ id: 'fake', object: 'chat.completion', choices: [{ message: { role: 'assistant', content } }] }));
    });
  });
  const fakeAddress = await listen(fakeOpenAiServer);
  process.env.OPENAI_API_KEY = 'test-key';
  process.env.OPENAI_BASE_URL = `http://127.0.0.1:${fakeAddress.port}/v1`;
  process.env.OPENAI_TIMEOUT_MS = '50';
  delete process.env.OPENAI_MAX_RETRIES;
  delete process.env.REQUEST_LEASE_MS;
  process.env.SAFER_DATA_DIR = dataDir;
  delete process.env.DATABASE_URL;
  delete process.env.FIXED_CONDITION;
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

test('Given the Express router, when session route registrations are inspected, then every authoritative route is registered exactly once', () => {
  const routes = [
    ['post', '/api/safer-start'],
    ['post', '/api/safer-intro'],
    ['post', '/api/safer-chat'],
    ['get', '/api/last-survey'],
  ];

  for (const [method, route] of routes) {
    const registrations = serverModule.app._router.stack.filter((layer) => (
      layer.route?.path === route && layer.route.methods?.[method] === true
    ));
    assert.equal(registrations.length, 1, `${method.toUpperCase()} ${route} registration count`);
  }
});

test('Given an unknown UUID cookie, when a session route is called, then authentication fails with 401', async () => {
  const unknownCookie = 'safer_session=11111111-1111-4111-8111-111111111111';

  const result = await request('/api/safer-start', {
    method: 'POST', body: {}, cookie: unknownCookie, requestId: 'unknown-cookie-start',
  });

  assert.equal(result.response.status, 401);
  assert.deepEqual(result.json, { ok: false, error: 'valid SAFER session required' });
});

test('Given identical names, when ten submissions run concurrently, then each receives an isolated server identity and UUID export', async () => {
  const results = await Promise.all(Array.from({ length: 10 }, (_, index) => request('/api/submit', {
    method: 'POST', body: SURVEY_PAYLOAD, requestId: `submission-${index}`,
  })));

  assert.equal(new Set(results.map(({ response }) => sessionToken(response))).size, 10);
  assert.equal(new Set(results.map(({ json }) => json.participantId)).size, 10);
  assert.equal(new Set(results.map(({ json }) => json.savedAs)).size, 10);
  for (const { response, json } of results) {
    assert.equal(response.status, 200);
    assert.equal(json.sessionId, undefined);
    assert.match(json.participantId, UUID_PATTERN);
    assert.notEqual(json.participantId, SURVEY_PAYLOAD.participantId);
    assert.equal(json.scenarioRowId, 0);
    assert.ok(['educator', 'coworker', 'future_self'].includes(json.condition));
    assert.equal(json.assignmentMode, 'balanced');
    assert.match(response.headers.get('set-cookie'), /^safer_session=.*HttpOnly.*SameSite=Lax/i);
    assert.equal(json.savedAs, `${json.participantId}.json`);
    assert.equal(json.data, undefined);
    const exported = JSON.parse(fs.readFileSync(path.join(dataDir, 'data', json.savedAs), 'utf8'));
    assert.equal(exported.sessionId, undefined);
    assert.equal(exported.data, undefined);
  }
  const stored = await serverModule.store.getSession(sessionToken(results[0].response));
  assert.equal(stored.data.preSurvey.participantId, undefined);
});

test('Given one request ID, when pre-survey submission is retried, then the original session is reused', async () => {
  const first = await request('/api/submit', { method: 'POST', body: SURVEY_PAYLOAD, requestId: 'retry-submit' });
  const retryPayload = {
    ...SURVEY_PAYLOAD,
    participantId: 'another-client-id',
    profile: { name: 'retry-name-must-not-win', org: 'retry-org-must-not-win' },
    incident: { ...SURVEY_PAYLOAD.incident, scenarioRowId: 999, sentence: 'retry scenario must not win' },
  };
  const second = await request('/api/submit', { method: 'POST', body: retryPayload, requestId: 'retry-submit' });

  assert.equal(sessionToken(second.response), sessionToken(first.response));
  assert.equal(second.json.participantId, first.json.participantId);
  assert.equal(second.json.scenarioRowId, 0);
  assert.equal(second.json.receivedAt, first.json.receivedAt);
  assert.equal(second.json.data, undefined);
  const session = await serverModule.store.getSession(sessionToken(first.response));
  assert.equal(session.data.preSurvey.profile.name, SURVEY_PAYLOAD.profile.name);
  const exported = JSON.parse(fs.readFileSync(path.join(dataDir, 'data', first.json.savedAs), 'utf8'));
  assert.equal(exported.scenarioRowId, 0);
  assert.equal(exported.data, undefined);
});

test('Given proxied HTTPS, when a session cookie is issued, then Secure follows the actual request protocol', async () => {
  const httpsResult = await request('/api/submit', {
    method: 'POST', body: SURVEY_PAYLOAD, requestId: 'https-cookie', forwardedProto: 'https',
  });
  const httpResult = await request('/api/submit', {
    method: 'POST', body: SURVEY_PAYLOAD, requestId: 'http-cookie', forwardedProto: 'http',
  });

  assert.match(httpsResult.response.headers.get('set-cookie'), /; Secure;/i);
  assert.doesNotMatch(httpResult.response.headers.get('set-cookie'), /; Secure;/i);
});

test('Given an HTTP client, when health and removed latest-survey routes are called, then only non-secret deployment metadata is returned', async () => {
  const health = await request('/api/health');
  const latest = await request('/api/last-survey');

  assert.deepEqual(health.json, {
    ok: true,
    store: { kind: 'memory', durable: false },
    assignmentMode: 'balanced',
    credentials: { openai: true, database: false },
    timing: { openaiTimeoutMs: 50, openaiMaxRetries: 0, requestLeaseMs: 120000 },
    limits: {
      windowMs: 600000,
      submitPerIp: 30,
      submitGlobal: 120,
      llmPerIp: 60,
      llmGlobal: 240,
      llmConcurrency: 12,
    },
  });
  assert.equal(latest.response.status, 410);
  assert.deepEqual(latest.json, { ok: false, error: 'last survey lookup is disabled' });
  assert.doesNotMatch(JSON.stringify(health.json), /test-key/);
  assert.ok(
    health.json.timing.requestLeaseMs >= Math.max(
      120000,
      health.json.timing.openaiTimeoutMs * (health.json.timing.openaiMaxRetries + 1) + 30000,
    ),
  );
});

test('Given an unsafe request lease, when the server initializes, then configuration is rejected', () => {
  const result = spawnSync(process.execPath, ['-e', "require('./server')"], {
    cwd: path.join(__dirname, '..'),
    encoding: 'utf8',
    env: {
      ...process.env,
      OPENAI_API_KEY: 'test-key',
      OPENAI_TIMEOUT_MS: '30000',
      OPENAI_MAX_RETRIES: '0',
      REQUEST_LEASE_MS: '119999',
    },
  });

  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /REQUEST_LEASE_MS.*at least 120000/);
});

test('Given a valid session cookie, when SAFER lifecycle requests carry conflicting client context, then stored context wins and requests are idempotent', async () => {
  const submitted = await request('/api/submit', { method: 'POST', body: SURVEY_PAYLOAD, requestId: 'lifecycle-submit' });
  const cookie = sessionCookie(submitted.response);
  const hostileBody = { condition: 'invalid', scenarioId: 'hostile', payload: { profile: { name: 'hostile' } }, safetyCase: { hostile: true } };

  const unauthorized = await request('/api/safer-start', { method: 'POST', body: {}, requestId: 'unauthorized-start' });
  assert.equal(unauthorized.response.status, 401);

  const started = await request('/api/safer-start', { method: 'POST', body: hostileBody, cookie, requestId: 'start-once' });
  const repeatedStart = await request('/api/safer-start', { method: 'POST', body: {}, cookie, requestId: 'start-once' });
  assert.equal(started.response.status, 200);
  assert.deepEqual(repeatedStart.json, started.json);
  assert.equal(started.json.condition, submitted.json.condition);
  assert.equal(started.json.scenarioRowId, 0);
  assert.notEqual(started.json.safetyCase.scenario.scenario_id, 'hostile');

  const conflictingReuse = await request('/api/safer-intro', {
    method: 'POST', body: {}, cookie, requestId: 'start-once',
  });
  assert.equal(conflictingReuse.response.status, 400);
  assert.deepEqual(conflictingReuse.json, {
    ok: false,
    error: 'request ID cannot be reused for another operation',
  });

  const intro = await request('/api/safer-intro', { method: 'POST', body: hostileBody, cookie, requestId: 'intro-once' });
  assert.equal(intro.response.status, 200);
  assert.equal(intro.json.condition, submitted.json.condition);
  assert.equal(intro.json.script.turn1, 'intro one');

  const turn4 = await request('/api/safer-chat', { method: 'POST', body: { ...hostileBody, turn: 4, userMessage: 'ignored at turn four' }, cookie, requestId: 'turn-4' });
  assert.equal(turn4.response.status, 200);
  assert.equal(turn4.json.turn, 4);

  const turn6OutOfOrder = await request('/api/safer-chat', { method: 'POST', body: { turn: 6 }, cookie, requestId: 'turn-6-too-early' });
  assert.equal(turn6OutOfOrder.response.status, 409);

  const turn5 = await request('/api/safer-chat', { method: 'POST', body: { ...hostileBody, turn: 5, userMessage: '안전수칙 답변', inputMethod: 'dictation' }, cookie, requestId: 'turn-5' });
  const repeatedTurn5 = await request('/api/safer-chat', { method: 'POST', body: { turn: 5, userMessage: '변조된 답변' }, cookie, requestId: 'turn-5' });
  assert.equal(turn5.response.status, 200);
  assert.deepEqual(repeatedTurn5.json, turn5.json);

  const turn6 = await request('/api/safer-chat', { method: 'POST', body: { ...hostileBody, turn: 6 }, cookie, requestId: 'turn-6' });
  assert.equal(turn6.response.status, 200);
  assert.equal(turn6.json.condition, submitted.json.condition);

  const session = await serverModule.store.getSession(sessionToken(submitted.response));
  assert.equal(session.data.preSurvey.profile.name, SURVEY_PAYLOAD.profile.name);
  assert.equal(session.data.turn4.assistant, turn4.json.assistant);
  assert.equal(session.data.turn5.userMessage, '안전수칙 답변');
  assert.equal(session.data.turn5.inputMethod, 'dictation');
  assert.deepEqual(session.data.turn5.response, turn5.json);
});

test('Given an upstream failure, when the same intro request ID is retried, then the failed request can complete', async () => {
  const submitted = await request('/api/submit', { method: 'POST', body: SURVEY_PAYLOAD, requestId: 'failure-submit' });
  const cookie = sessionCookie(submitted.response);
  await request('/api/safer-start', { method: 'POST', body: {}, cookie, requestId: 'failure-start' });
  fakeFailuresRemaining = 1;

  const failed = await request('/api/safer-intro', { method: 'POST', body: {}, cookie, requestId: 'retry-intro' });
  const retried = await request('/api/safer-intro', { method: 'POST', body: {}, cookie, requestId: 'retry-intro' });

  assert.equal(failed.response.status, 500);
  assert.equal(failed.json.error, '요청을 처리하지 못했습니다. 같은 버튼으로 다시 시도해 주세요.');
  assert.doesNotMatch(JSON.stringify(failed.json), /temporary fake failure/i);
  assert.equal(retried.response.status, 200);
  assert.equal(retried.json.script.turn1, 'intro one');
});

test('Given a completed conversation, when post-survey repeats the same request ID, then identity and side effects remain from the first request', async () => {
  const submitted = await request('/api/submit', { method: 'POST', body: SURVEY_PAYLOAD, requestId: 'post-submit' });
  const cookie = await completeConversation(submitted, 'post-flow');
  const originalCompleteRequest = serverModule.store.completeRequest.bind(serverModule.store);
  let postSurveyUpdates = 0;
  serverModule.store.completeRequest = async (...args) => {
    if (args[1]?.sessionData?.postSurvey) postSurveyUpdates += 1;
    return originalCompleteRequest(...args);
  };
  try {
    const post = await request('/api/submit-post-survey', {
      method: 'POST', cookie, requestId: 'post-once',
      body: { sessionId: 'forged', participantId: 'forged', condition: 'forged', scenarioRowId: 'forged', name: 'forged', answers: { q1: 5 } },
    });
    const repeated = await request('/api/submit-post-survey', {
      method: 'POST', cookie, requestId: 'post-once',
      body: { participantId: 'different', condition: 'different', scenarioRowId: 999, name: 'different', answers: { q1: 1 } },
    });

    assert.equal(post.response.status, 200);
    assert.deepEqual(repeated.json, post.json);
    assert.equal(post.json.participantId, submitted.json.participantId);
    assert.equal(post.json.condition, submitted.json.condition);
    assert.equal(post.json.scenarioRowId, 0);
  } finally {
    serverModule.store.completeRequest = originalCompleteRequest;
  }
  assert.equal(postSurveyUpdates, 1);
  const session = await serverModule.store.getSession(sessionToken(submitted.response));
  assert.equal(session.data.postSurvey.participantId, submitted.json.participantId);
  assert.equal(session.data.postSurvey.sessionId, undefined);
  assert.equal(session.data.postSurvey.name, SURVEY_PAYLOAD.profile.name);
  assert.equal(session.data.postSurvey.answers.q1, 5);
  const exported = JSON.parse(fs.readFileSync(path.join(dataDir, 'survey', `${submitted.json.participantId}.json`), 'utf8'));
  assert.equal(exported.sessionId, undefined);
  assert.equal(exported.answers.q1, 5);
});

test('Given an incomplete conversation, when post-survey is submitted, then it is rejected without persistence', async () => {
  const submitted = await request('/api/submit', { method: 'POST', body: SURVEY_PAYLOAD, requestId: 'post-early-submit' });
  const cookie = sessionCookie(submitted.response);

  const post = await request('/api/submit-post-survey', {
    method: 'POST', cookie, requestId: 'post-too-early', body: { answers: { q1: 5 } },
  });

  assert.equal(post.response.status, 409);
  const session = await serverModule.store.getSession(sessionToken(submitted.response));
  assert.equal(session.data.postSurvey, undefined);
  assert.equal(fs.existsSync(path.join(dataDir, 'survey', `${submitted.json.participantId}.json`)), false);
});
