const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const test = require('node:test');

const { PostgresExperimentStore } = require('../lib/postgresExperimentStore');
const { readCompletedSessions } = require('../scripts/google_sheets/exporter');

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

test(
  'Google Sheets export query returns a completed session from real Postgres',
  { skip: !TEST_DATABASE_URL },
  async () => {
    const store = new PostgresExperimentStore({
      connectionString: TEST_DATABASE_URL,
      fixedCondition: 'educator',
    });
    await store.bootstrap();
    const session = await store.createSession({
      submissionKey: randomUUID(),
      data: {
        scenarioRowId: 17,
        preSurvey: { profile: { name: 'integration', org: 'test' } },
      },
    });
    const complete = async (operation, turn, sessionData) => {
      const requestId = randomUUID();
      const request = await store.beginRequest(session.sessionId, {
        requestId,
        operation,
        ...(turn === undefined ? {} : { turn }),
      });
      await store.completeRequest(session.sessionId, {
        requestId,
        leaseGeneration: request.leaseGeneration,
        response: { ok: true },
        sessionData,
      });
    };

    try {
      await complete('start', undefined, { turn0: { assistant: 'start' } });
      await complete('intro', undefined, { introScript: { turn1: 'intro' } });
      await complete('chat', 4, { turn4: { assistant: 'question' } });
      await complete('chat', 5, {
        turn5: { userMessage: 'answer', inputMethod: 'keyboard', response: { ok: true } },
      });
      await complete('chat', 6, { turn6: { assistant: 'done' } });
      await complete('post', undefined, { postSurvey: { q1: 5 } });

      const rows = await readCompletedSessions(store.pool);
      const exported = rows.find((row) => row.participantId === session.participantId);
      assert.ok(exported);
      assert.equal(exported.phase, 'completed');
      assert.equal(exported.data.scenarioRowId, 17);
      assert.equal(exported.data.turn5.inputMethod, 'keyboard');
      assert.ok(exported.completedAt);
    } finally {
      await store.pool.query('DELETE FROM experiment_sessions WHERE session_id = $1', [session.sessionId]);
      await store.close();
    }
  },
);
