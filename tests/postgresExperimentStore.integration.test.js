const test = require('node:test');
const assert = require('node:assert/strict');

const { PostgresExperimentStore } = require('../lib/postgresExperimentStore');

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
const CONDITIONS = ['educator', 'coworker', 'future_self'];

test(
  'Postgres store persists balanced concurrent sessions and rolls back failed creation',
  { skip: !TEST_DATABASE_URL },
  async () => {
    const store = new PostgresExperimentStore({
      connectionString: TEST_DATABASE_URL,
      random: () => 0,
      requestLeaseMs: 1_000,
    });

    try {
      await store.bootstrap();
      await store.pool.query(
        'TRUNCATE session_events, session_requests, experiment_sessions RESTART IDENTITY',
      );

      const sessions = await Promise.all(
        Array.from({ length: 30 }, (_, index) =>
          store.createSession({ submissionKey: `concurrent-${index}` }),
        ),
      );
      const counts = Object.fromEntries(CONDITIONS.map((condition) => [condition, 0]));
      for (const session of sessions) {
        counts[session.condition] += 1;
      }
      assert.deepEqual(counts, { educator: 10, coworker: 10, future_self: 10 });
      assert.equal(new Set(sessions.map((session) => session.sessionId)).size, 30);
      assert.equal(new Set(sessions.map((session) => session.participantId)).size, 30);

      const original = await store.createSession({ submissionKey: 'idempotent-key' });
      const repeated = await store.createSession({ submissionKey: 'idempotent-key' });
      assert.equal(repeated.sessionId, original.sessionId);

      const lifecycle = await store.createSession({ submissionKey: 'lifecycle-key' });
      await store.beginRequest(lifecycle.sessionId, {
        requestId: 'start-request',
        operation: 'start',
      });
      assert.equal(
        (
          await store.beginRequest(lifecycle.sessionId, {
            requestId: 'start-request',
            operation: 'start',
          })
        ).status,
        'pending',
      );
      const completed = await store.completeRequest(lifecycle.sessionId, {
        requestId: 'start-request',
        leaseGeneration: 1,
        response: { turn: 0 },
      });
      assert.equal(completed.status, 'completed');
      assert.deepEqual(
        await store.completeRequest(lifecycle.sessionId, {
          requestId: 'start-request',
          leaseGeneration: 1,
          response: { turn: 0, ignored: true },
        }),
        completed,
      );
      await store.beginRequest(lifecycle.sessionId, {
        requestId: 'intro-request',
        operation: 'intro',
      });
      await store.completeRequest(lifecycle.sessionId, {
        requestId: 'intro-request',
        leaseGeneration: 1,
        response: { turns: [1, 2, 3] },
      });
      await assert.rejects(
        store.beginRequest(lifecycle.sessionId, {
          requestId: 'turn-five-request',
          operation: 'chat',
          turn: 5,
        }),
        /out of order/,
      );

      const staleSession = await store.createSession({ submissionKey: 'stale-request-key' });
      await store.beginRequest(staleSession.sessionId, {
        requestId: 'lease-request',
        operation: 'start',
      });
      assert.equal(
        (
          await store.beginRequest(staleSession.sessionId, {
            requestId: 'lease-request',
            operation: 'start',
          })
        ).status,
        'pending',
      );
      await store.pool.query(
        `UPDATE session_requests
         SET started_at = now() - interval '2 seconds'
         WHERE session_id = $1 AND request_id = $2`,
        [staleSession.sessionId, 'lease-request'],
      );
      assert.equal(
        (
          await store.beginRequest(staleSession.sessionId, {
            requestId: 'lease-request',
            operation: 'start',
          })
        ).status,
        'started',
      );

      const postSession = await store.createSession({ submissionKey: 'post-lifecycle-key' });
      await assert.rejects(
        store.beginRequest(postSession.sessionId, {
          requestId: 'post-request',
          operation: 'post',
        }),
        /out of order/,
      );
      for (const request of [
        { requestId: 'post-start-request', operation: 'start' },
        { requestId: 'post-intro-request', operation: 'intro' },
        { requestId: 'post-turn-four-request', operation: 'chat', turn: 4 },
        { requestId: 'post-turn-five-request', operation: 'chat', turn: 5 },
        { requestId: 'post-turn-six-request', operation: 'chat', turn: 6 },
      ]) {
        await store.beginRequest(postSession.sessionId, request);
        await store.completeRequest(postSession.sessionId, {
          requestId: request.requestId,
          leaseGeneration: 1,
          response: { requestId: request.requestId },
        });
      }
      await store.beginRequest(postSession.sessionId, {
        requestId: 'post-request',
        operation: 'post',
      });
      const completedPost = await store.completeRequest(postSession.sessionId, {
        requestId: 'post-request',
        leaseGeneration: 1,
        response: { saved: true },
      });
      assert.deepEqual(
        await store.beginRequest(postSession.sessionId, {
          requestId: 'post-request',
          operation: 'post',
        }),
        completedPost,
      );
      assert.equal((await store.getSession(postSession.sessionId)).phase, 'completed');

      await store.pool.query(`
        CREATE OR REPLACE FUNCTION safer_test_fail_session_event()
        RETURNS trigger AS $$
        BEGIN
          RAISE EXCEPTION 'forced session event failure';
        END;
        $$ LANGUAGE plpgsql
      `);
      await store.pool.query(`
        CREATE TRIGGER safer_test_fail_session_event_trigger
        BEFORE INSERT ON session_events
        FOR EACH ROW
        WHEN (NEW.event_type = 'session_created')
        EXECUTE FUNCTION safer_test_fail_session_event()
      `);
      try {
        await assert.rejects(
          store.createSession({ submissionKey: 'forced-rollback-key' }),
          /forced session event failure/,
        );
        const failedSession = await store.pool.query(
          'SELECT 1 FROM experiment_sessions WHERE submission_key = $1',
          ['forced-rollback-key'],
        );
        assert.equal(failedSession.rowCount, 0);
      } finally {
        await store.pool.query('DROP TRIGGER IF EXISTS safer_test_fail_session_event_trigger ON session_events');
        await store.pool.query('DROP FUNCTION IF EXISTS safer_test_fail_session_event()');
      }
    } finally {
      await store.close();
    }
  },
);

test(
  'Postgres store fences stale owners after reclaiming a request lease',
  { skip: !TEST_DATABASE_URL },
  async () => {
    const store = new PostgresExperimentStore({
      connectionString: TEST_DATABASE_URL,
      requestLeaseMs: 1_000,
    });

    try {
      await store.bootstrap();
      await store.pool.query(
        'TRUNCATE session_events, session_requests, experiment_sessions RESTART IDENTITY',
      );

      const session = await store.createSession({ submissionKey: 'postgres-lease-fencing' });
      const firstLease = await store.beginRequest(session.sessionId, {
        requestId: 'lease-fencing-request',
        operation: 'start',
      });
      assert.equal(firstLease.leaseGeneration, 1);

      await store.pool.query(
        `UPDATE session_requests
         SET started_at = now() - interval '2 seconds'
         WHERE session_id = $1 AND request_id = $2`,
        [session.sessionId, 'lease-fencing-request'],
      );
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

      const leaseColumn = await store.pool.query(
        `SELECT is_nullable, column_default
         FROM information_schema.columns
         WHERE table_name = 'session_requests' AND column_name = 'lease_generation'`,
      );
      assert.deepEqual(leaseColumn.rows[0].is_nullable, 'NO');
      assert.match(leaseColumn.rows[0].column_default, /1/);
    } finally {
      await store.close();
    }
  },
);

test(
  'Postgres bootstrap backfills and requires lease generation for a legacy request row',
  { skip: !TEST_DATABASE_URL },
  async () => {
    const store = new PostgresExperimentStore({ connectionString: TEST_DATABASE_URL });

    try {
      await store.bootstrap();
      await store.pool.query(
        'TRUNCATE session_events, session_requests, experiment_sessions RESTART IDENTITY',
      );
      const session = await store.createSession({ submissionKey: 'postgres-lease-migration' });
      await store.beginRequest(session.sessionId, {
        requestId: 'legacy-request',
        operation: 'start',
      });
      await store.pool.query('ALTER TABLE session_requests ALTER COLUMN lease_generation DROP NOT NULL');
      await store.pool.query('ALTER TABLE session_requests ALTER COLUMN lease_generation DROP DEFAULT');
      await store.pool.query('UPDATE session_requests SET lease_generation = NULL');

      await store.bootstrap();
      const request = await store.pool.query(
        `SELECT lease_generation
         FROM session_requests
         WHERE session_id = $1 AND request_id = $2`,
        [session.sessionId, 'legacy-request'],
      );
      const leaseColumn = await store.pool.query(
        `SELECT is_nullable, column_default
         FROM information_schema.columns
         WHERE table_name = 'session_requests' AND column_name = 'lease_generation'`,
      );
      assert.equal(Number(request.rows[0].lease_generation), 1);
      assert.equal(leaseColumn.rows[0].is_nullable, 'NO');
      assert.match(leaseColumn.rows[0].column_default, /1/);
    } finally {
      await store.close();
    }
  },
);

test(
  'Postgres store lets only the current lease commit when two workers complete concurrently',
  { skip: !TEST_DATABASE_URL },
  async () => {
    const firstWorker = new PostgresExperimentStore({
      connectionString: TEST_DATABASE_URL,
      requestLeaseMs: 1_000,
    });
    const retryWorker = new PostgresExperimentStore({
      connectionString: TEST_DATABASE_URL,
      requestLeaseMs: 1_000,
    });

    try {
      await firstWorker.bootstrap();
      await retryWorker.bootstrap();
      await firstWorker.pool.query(
        'TRUNCATE session_events, session_requests, experiment_sessions RESTART IDENTITY',
      );
      const session = await firstWorker.createSession({ submissionKey: 'concurrent-lease-workers' });
      const staleLease = await firstWorker.beginRequest(session.sessionId, {
        requestId: 'concurrent-completion',
        operation: 'start',
      });
      await firstWorker.pool.query(
        `UPDATE session_requests
         SET started_at = now() - interval '2 seconds'
         WHERE session_id = $1 AND request_id = $2`,
        [session.sessionId, 'concurrent-completion'],
      );
      const currentLease = await retryWorker.beginRequest(session.sessionId, {
        requestId: 'concurrent-completion',
        operation: 'start',
      });

      const [staleResult, currentResult] = await Promise.allSettled([
        firstWorker.completeRequest(session.sessionId, {
          requestId: 'concurrent-completion',
          leaseGeneration: staleLease.leaseGeneration,
          response: { owner: 'stale' },
          sessionData: { completionOwner: 'stale' },
        }),
        retryWorker.completeRequest(session.sessionId, {
          requestId: 'concurrent-completion',
          leaseGeneration: currentLease.leaseGeneration,
          response: { owner: 'current' },
          sessionData: { completionOwner: 'current' },
        }),
      ]);

      assert.equal(staleResult.status, 'rejected');
      assert.match(staleResult.reason.message, /lease generation/);
      assert.equal(currentResult.status, 'fulfilled');
      assert.equal(currentResult.value.response.owner, 'current');
      const persisted = await retryWorker.getSession(session.sessionId);
      assert.equal(persisted.data.completionOwner, 'current');
      assert.equal(persisted.phase, 'started');
    } finally {
      await Promise.all([firstWorker.close(), retryWorker.close()]);
    }
  },
);
