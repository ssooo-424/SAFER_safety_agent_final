const test = require('node:test');
const assert = require('node:assert/strict');

const { CONDITIONS } = require('../lib/conditionAssignment');
const { MemoryExperimentStore } = require('../lib/memoryExperimentStore');
const { PostgresExperimentStore } = require('../lib/postgresExperimentStore');
const { createExperimentStore } = require('../lib/experimentStore');

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[4-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

test('ten concurrent anonymous sessions receive distinct session and participant UUIDs', async () => {
  const store = new MemoryExperimentStore();
  const sessions = await Promise.all(
    Array.from({ length: 10 }, (_, index) =>
      store.createSession({ submissionKey: `submission-${index}` }),
    ),
  );

  assert.equal(new Set(sessions.map((session) => session.sessionId)).size, 10);
  assert.equal(new Set(sessions.map((session) => session.participantId)).size, 10);
  for (const session of sessions) {
    assert.match(session.sessionId, UUID_PATTERN);
    assert.match(session.participantId, UUID_PATTERN);
    assert.notEqual(session.sessionId, session.participantId);
  }
});

test('nine store assignments are balanced at every prefix and finish 3/3/3', async () => {
  const store = new MemoryExperimentStore({ random: () => 0 });
  const counts = Object.fromEntries(CONDITIONS.map((condition) => [condition, 0]));

  for (let index = 0; index < 9; index += 1) {
    const session = await store.createSession({ submissionKey: `balanced-${index}` });
    counts[session.condition] += 1;
    const values = Object.values(counts);
    assert.ok(Math.max(...values) - Math.min(...values) <= 1);
  }

  assert.deepEqual(counts, { educator: 3, coworker: 3, future_self: 3 });
});

test('fixed condition overrides balanced assignment and cannot be changed', async () => {
  const store = new MemoryExperimentStore({ fixedCondition: 'coworker' });
  const session = await store.createSession({ submissionKey: 'fixed-condition' });

  assert.equal(session.condition, 'coworker');
  assert.equal(session.assignmentMode, 'fixed');
  await assert.rejects(
    store.updateSession(session.sessionId, { condition: 'future_self' }),
    /condition is immutable/,
  );
  assert.equal((await store.getSession(session.sessionId)).condition, 'coworker');
});

test('an existing submission key returns the originally created session', async () => {
  const store = new MemoryExperimentStore();
  const original = await store.createSession({ submissionKey: 'same-submission' });
  const duplicate = await store.createSession({ submissionKey: 'same-submission' });

  assert.equal(duplicate.sessionId, original.sessionId);
  assert.equal(duplicate.participantId, original.participantId);
  assert.equal(duplicate.condition, original.condition);
});

test('factory uses a two-minute default lease and validates explicit lease values', async () => {
  let currentTime = Date.UTC(2026, 7, 20, 0, 0, 0);
  const store = createExperimentStore({
    env: {},
    now: () => new Date(currentTime),
  });
  assert.equal(store.requestLeaseMs, 120_000);

  const session = await store.createSession({ submissionKey: 'default-lease' });
  await store.beginRequest(session.sessionId, {
    requestId: 'lease-request',
    operation: 'start',
  });
  currentTime += 30_001;
  assert.equal(
    (
      await store.beginRequest(session.sessionId, {
        requestId: 'lease-request',
        operation: 'start',
      })
    ).status,
    'pending',
  );

  assert.equal(
    createExperimentStore({ env: { REQUEST_LEASE_MS: '180000' } }).requestLeaseMs,
    180_000,
  );
  assert.equal(
    createExperimentStore({
      env: { REQUEST_LEASE_MS: '180000' },
      requestLeaseMs: 240_000,
    }).requestLeaseMs,
    240_000,
  );
  assert.throws(
    () => createExperimentStore({ env: { REQUEST_LEASE_MS: '0' } }),
    /REQUEST_LEASE_MS must be a positive number/,
  );
});

test('memory store reports an already-started request as pending', async () => {
  const store = new MemoryExperimentStore();
  const session = await store.createSession({ submissionKey: 'memory-inflight' });
  await store.beginRequest(session.sessionId, {
    requestId: 'inflight-request',
    operation: 'start',
  });

  const retry = await store.beginRequest(session.sessionId, {
    requestId: 'inflight-request',
    operation: 'start',
  });

  assert.equal(retry.status, 'pending');
});

test('memory store reclaims a stale request with the same ID but keeps fresh requests pending', async () => {
  let currentTime = Date.UTC(2026, 7, 20, 0, 0, 0);
  const store = new MemoryExperimentStore({
    requestLeaseMs: 1_000,
    now: () => new Date(currentTime),
  });
  const session = await store.createSession({ submissionKey: 'memory-stale-request' });
  await store.beginRequest(session.sessionId, {
    requestId: 'lease-request',
    operation: 'start',
  });
  assert.equal(
    (
      await store.beginRequest(session.sessionId, {
        requestId: 'lease-request',
        operation: 'start',
      })
    ).status,
    'pending',
  );

  currentTime += 1_001;
  assert.equal(
    (
      await store.beginRequest(session.sessionId, {
        requestId: 'lease-request',
        operation: 'start',
      })
    ).status,
    'started',
  );
  await assert.rejects(
    store.beginRequest(session.sessionId, {
      requestId: 'lease-request',
      operation: 'intro',
    }),
    /requestId cannot be reused/,
  );
});

test('memory store fences stale request owners with an incremented lease generation', async () => {
  let currentTime = Date.UTC(2026, 7, 20, 0, 0, 0);
  const store = new MemoryExperimentStore({
    requestLeaseMs: 1_000,
    now: () => new Date(currentTime),
  });
  const session = await store.createSession({ submissionKey: 'memory-lease-fencing' });
  const firstLease = await store.beginRequest(session.sessionId, {
    requestId: 'lease-fencing-request',
    operation: 'start',
  });
  assert.equal(firstLease.leaseGeneration, 1);

  currentTime += 1_001;
  const reclaimedLease = await store.beginRequest(session.sessionId, {
    requestId: 'lease-fencing-request',
    operation: 'start',
  });
  assert.equal(reclaimedLease.leaseGeneration, 2);

  await assert.rejects(
    store.completeRequest(session.sessionId, {
      requestId: 'lease-fencing-request',
      leaseGeneration: firstLease.leaseGeneration,
      response: { owner: 'stale' },
      sessionData: { completionOwner: 'stale' },
    }),
    /lease generation/,
  );
  await assert.rejects(
    store.failRequest(session.sessionId, {
      requestId: 'lease-fencing-request',
      leaseGeneration: firstLease.leaseGeneration,
    }),
    /lease generation/,
  );

  const completed = await store.completeRequest(session.sessionId, {
    requestId: 'lease-fencing-request',
    leaseGeneration: reclaimedLease.leaseGeneration,
    response: { owner: 'current' },
    sessionData: { completionOwner: 'current' },
  });
  assert.equal(completed.response.owner, 'current');
  assert.equal((await store.getSession(session.sessionId)).data.completionOwner, 'current');
  assert.deepEqual(
    await store.completeRequest(session.sessionId, {
      requestId: 'lease-fencing-request',
      leaseGeneration: reclaimedLease.leaseGeneration,
      response: { owner: 'must-not-overwrite' },
      sessionData: { completionOwner: 'must-not-overwrite' },
    }),
    completed,
  );
  assert.equal((await store.getSession(session.sessionId)).data.completionOwner, 'current');
});

test('memory store increments the lease generation when a failed request restarts', async () => {
  const store = new MemoryExperimentStore();
  const session = await store.createSession({ submissionKey: 'memory-failed-lease-fencing' });
  const firstLease = await store.beginRequest(session.sessionId, {
    requestId: 'failed-lease-request',
    operation: 'start',
  });
  await store.failRequest(session.sessionId, {
    requestId: 'failed-lease-request',
    leaseGeneration: firstLease.leaseGeneration,
  });

  const restartedLease = await store.beginRequest(session.sessionId, {
    requestId: 'failed-lease-request',
    operation: 'start',
  });
  assert.equal(restartedLease.leaseGeneration, 2);
  await assert.rejects(
    store.completeRequest(session.sessionId, {
      requestId: 'failed-lease-request',
      leaseGeneration: firstLease.leaseGeneration,
      response: { owner: 'stale' },
    }),
    /lease generation/,
  );
});

test('memory store rejects a started request ID reused for another operation', async () => {
  const store = new MemoryExperimentStore();
  const session = await store.createSession({ submissionKey: 'memory-started-mismatch' });
  await store.beginRequest(session.sessionId, {
    requestId: 'same-request',
    operation: 'start',
  });

  await assert.rejects(
    store.beginRequest(session.sessionId, {
      requestId: 'same-request',
      operation: 'intro',
    }),
    /requestId cannot be reused/,
  );
});

test('memory store rejects a completed request ID reused for another operation', async () => {
  const store = new MemoryExperimentStore();
  const session = await store.createSession({ submissionKey: 'memory-mismatched-request' });
  await store.beginRequest(session.sessionId, {
    requestId: 'same-request',
    operation: 'start',
  });
  await store.completeRequest(session.sessionId, {
    requestId: 'same-request',
    leaseGeneration: 1,
    response: { turn: 0 },
  });

  await assert.rejects(
    store.beginRequest(session.sessionId, {
      requestId: 'same-request',
      operation: 'intro',
    }),
    /requestId cannot be reused/,
  );
});

test('request completion is idempotent and out-of-order turns are rejected', async () => {
  const store = new MemoryExperimentStore();
  const session = await store.createSession({ submissionKey: 'request-lifecycle' });

  const started = await store.beginRequest(session.sessionId, {
    requestId: 'start-request',
    operation: 'start',
  });
  assert.equal(started.status, 'started');
  const completedStart = await store.completeRequest(session.sessionId, {
    requestId: 'start-request',
    leaseGeneration: started.leaseGeneration,
    response: { turn: 0, assistant: 'start response' },
  });
  const repeatedStartCompletion = await store.completeRequest(session.sessionId, {
    requestId: 'start-request',
    leaseGeneration: started.leaseGeneration,
    response: { turn: 0, assistant: 'different response must be ignored' },
  });
  assert.deepEqual(repeatedStartCompletion, completedStart);
  assert.equal(
    (await store.beginRequest(session.sessionId, {
      requestId: 'start-request',
      operation: 'start',
    })).status,
    'completed',
  );

  await store.beginRequest(session.sessionId, {
    requestId: 'intro-request',
    operation: 'intro',
  });
  await store.completeRequest(session.sessionId, {
    requestId: 'intro-request',
    leaseGeneration: 1,
    response: { turns: [1, 2, 3] },
  });
  await assert.rejects(
    store.beginRequest(session.sessionId, {
      requestId: 'turn-five-request',
      operation: 'chat',
      turn: 5,
    }),
    /out of order/,
  );
  await store.beginRequest(session.sessionId, {
    requestId: 'turn-four-request',
    operation: 'chat',
    turn: 4,
  });
  await store.completeRequest(session.sessionId, {
    requestId: 'turn-four-request',
    leaseGeneration: 1,
    response: { turn: 4, assistant: 'turn four response' },
  });
  const turnFive = await store.beginRequest(session.sessionId, {
    requestId: 'turn-five-request',
    operation: 'chat',
    turn: 5,
  });
  assert.equal(turnFive.status, 'started');
});

test('post request is allowed only after turn six and caches its completed response', async () => {
  const store = new MemoryExperimentStore();
  const session = await store.createSession({ submissionKey: 'post-lifecycle' });
  await assert.rejects(
    store.beginRequest(session.sessionId, {
      requestId: 'post-request',
      operation: 'post',
    }),
    /out of order/,
  );

  for (const request of [
    { requestId: 'start-request', operation: 'start' },
    { requestId: 'intro-request', operation: 'intro' },
    { requestId: 'turn-four-request', operation: 'chat', turn: 4 },
    { requestId: 'turn-five-request', operation: 'chat', turn: 5 },
    { requestId: 'turn-six-request', operation: 'chat', turn: 6 },
  ]) {
    await store.beginRequest(session.sessionId, request);
    await store.completeRequest(session.sessionId, {
      requestId: request.requestId,
      leaseGeneration: 1,
      response: { requestId: request.requestId },
    });
  }

  await store.beginRequest(session.sessionId, {
    requestId: 'post-request',
    operation: 'post',
  });
  const completed = await store.completeRequest(session.sessionId, {
    requestId: 'post-request',
    leaseGeneration: 1,
    response: { saved: true },
  });
  assert.deepEqual(
    await store.beginRequest(session.sessionId, {
      requestId: 'post-request',
      operation: 'post',
    }),
    completed,
  );
  assert.equal((await store.getSession(session.sessionId)).phase, 'completed');
});

test('stores expose a shared lifecycle API and local factory selects memory storage', async () => {
  const publicMethods = [
    'bootstrap',
    'createSession',
    'getSession',
    'updateSession',
    'beginRequest',
    'completeRequest',
    'failRequest',
    'close',
  ];
  for (const method of publicMethods) {
    assert.equal(typeof MemoryExperimentStore.prototype[method], 'function');
    assert.equal(typeof PostgresExperimentStore.prototype[method], 'function');
  }

  const store = createExperimentStore({ env: {} });
  assert.equal(store.durable, false);
  assert.ok(store instanceof MemoryExperimentStore);
  await store.bootstrap();
});

test('memory close is a no-op and Postgres closes only pools it owns', async () => {
  const memoryStore = new MemoryExperimentStore();
  await memoryStore.close();

  let injectedCloseCalls = 0;
  const injectedStore = new PostgresExperimentStore({
    pool: {
      async end() {
        injectedCloseCalls += 1;
      },
    },
  });
  await injectedStore.close();
  assert.equal(injectedCloseCalls, 0);

  let ownedCloseCalls = 0;
  const ownedStore = new PostgresExperimentStore({
    connectionString: 'postgresql://unused.example.invalid/safer',
  });
  ownedStore.pool = {
    async end() {
      ownedCloseCalls += 1;
    },
  };
  await ownedStore.close();
  assert.equal(ownedCloseCalls, 1);
});

test('malformed session IDs return null without issuing a Postgres query', async () => {
  const memoryStore = new MemoryExperimentStore();
  assert.equal(await memoryStore.getSession('not-a-uuid'), null);

  const postgresStore = new PostgresExperimentStore({
    pool: {
      async query() {
        throw new Error('getSession must not query malformed UUIDs');
      },
    },
  });
  assert.equal(await postgresStore.getSession('not-a-uuid'), null);
});

test('Postgres store reports an already-started request as pending', async () => {
  const sessionId = '11111111-1111-4111-8111-111111111111';
  const client = {
    async query(text) {
      if (text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK') {
        return { rows: [], rowCount: 0 };
      }
      if (text.includes('FROM experiment_sessions')) {
        return {
          rows: [
            {
              session_id: sessionId,
              participant_id: '22222222-2222-4222-8222-222222222222',
              condition: 'educator',
              assignment_mode: 'balanced',
              data: {},
              phase: 'created',
              next_turn: 4,
              created_at: new Date(),
            },
          ],
          rowCount: 1,
        };
      }
      if (text.includes('FROM session_requests')) {
        return {
          rows: [
            {
              session_id: sessionId,
              request_id: 'inflight-request',
              operation: 'start',
              turn: null,
              status: 'started',
              started_at: new Date(),
              response: null,
            },
          ],
          rowCount: 1,
        };
      }
      throw new Error(`unexpected query: ${text}`);
    },
    release() {},
  };
  const store = new PostgresExperimentStore({
    pool: { connect: async () => client },
  });

  const request = await store.beginRequest(sessionId, {
    requestId: 'inflight-request',
    operation: 'start',
  });

  assert.equal(request.status, 'pending');
});

test('Postgres store atomically reclaims a stale request with the same ID', async () => {
  const sessionId = '77777777-7777-4777-8777-777777777777';
  const currentTime = new Date('2026-08-20T00:00:02.000Z');
  let restartParameters;
  const client = {
    async query(text, parameters) {
      if (text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK') {
        return { rows: [], rowCount: 0 };
      }
      if (text.includes('FROM experiment_sessions')) {
        return {
          rows: [
            {
              session_id: sessionId,
              participant_id: '88888888-8888-4888-8888-888888888888',
              condition: 'educator',
              assignment_mode: 'balanced',
              data: {},
              phase: 'created',
              next_turn: 4,
              created_at: currentTime,
            },
          ],
          rowCount: 1,
        };
      }
      if (text.includes('SELECT * FROM session_requests')) {
        return {
          rows: [
            {
              session_id: sessionId,
              request_id: 'lease-request',
              operation: 'start',
              turn: null,
              status: 'started',
              started_at: new Date('2026-08-20T00:00:00.000Z'),
              response: null,
            },
          ],
          rowCount: 1,
        };
      }
      if (text.includes('lease_generation = lease_generation + 1')) {
        restartParameters = parameters;
        return {
          rows: [
            {
              session_id: sessionId,
              request_id: 'lease-request',
              operation: 'start',
              turn: null,
              status: 'started',
              lease_generation: 2,
              started_at: currentTime,
              response: null,
            },
          ],
          rowCount: 1,
        };
      }
      throw new Error(`unexpected query: ${text}`);
    },
    release() {},
  };
  const store = new PostgresExperimentStore({
    pool: { connect: async () => client },
    requestLeaseMs: 1_000,
    now: () => currentTime,
  });

  const request = await store.beginRequest(sessionId, {
    requestId: 'lease-request',
    operation: 'start',
  });

  assert.equal(request.status, 'started');
  assert.equal(request.leaseGeneration, 2);
  assert.equal(restartParameters[2].toISOString(), currentTime.toISOString());
});

test('Postgres store rejects a started request ID reused for another operation', async () => {
  const sessionId = '55555555-5555-4555-8555-555555555555';
  const client = {
    async query(text) {
      if (text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK') {
        return { rows: [], rowCount: 0 };
      }
      if (text.includes('FROM experiment_sessions')) {
        return {
          rows: [
            {
              session_id: sessionId,
              participant_id: '66666666-6666-4666-8666-666666666666',
              condition: 'educator',
              assignment_mode: 'balanced',
              data: {},
              phase: 'created',
              next_turn: 4,
              created_at: new Date(),
            },
          ],
          rowCount: 1,
        };
      }
      if (text.includes('FROM session_requests')) {
        return {
          rows: [
            {
              session_id: sessionId,
              request_id: 'same-request',
              operation: 'start',
              turn: null,
              status: 'started',
              response: null,
            },
          ],
          rowCount: 1,
        };
      }
      throw new Error(`unexpected query: ${text}`);
    },
    release() {},
  };
  const store = new PostgresExperimentStore({
    pool: { connect: async () => client },
  });

  await assert.rejects(
    store.beginRequest(sessionId, {
      requestId: 'same-request',
      operation: 'intro',
    }),
    /requestId cannot be reused/,
  );
});

test('Postgres store rejects a completed request ID reused for another operation', async () => {
  const sessionId = '33333333-3333-4333-8333-333333333333';
  const client = {
    async query(text) {
      if (text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK') {
        return { rows: [], rowCount: 0 };
      }
      if (text.includes('FROM experiment_sessions')) {
        return {
          rows: [
            {
              session_id: sessionId,
              participant_id: '44444444-4444-4444-8444-444444444444',
              condition: 'educator',
              assignment_mode: 'balanced',
              data: {},
              phase: 'started',
              next_turn: 4,
              created_at: new Date(),
            },
          ],
          rowCount: 1,
        };
      }
      if (text.includes('FROM session_requests')) {
        return {
          rows: [
            {
              session_id: sessionId,
              request_id: 'same-request',
              operation: 'start',
              turn: null,
              status: 'completed',
              response: { turn: 0 },
            },
          ],
          rowCount: 1,
        };
      }
      throw new Error(`unexpected query: ${text}`);
    },
    release() {},
  };
  const store = new PostgresExperimentStore({
    pool: { connect: async () => client },
  });

  await assert.rejects(
    store.beginRequest(sessionId, {
      requestId: 'same-request',
      operation: 'intro',
    }),
    /requestId cannot be reused/,
  );
});
