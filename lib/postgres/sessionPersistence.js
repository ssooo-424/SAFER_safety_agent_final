const { randomUUID } = require('node:crypto');

const { CONDITIONS, chooseBalancedCondition } = require('../conditionAssignment');
const {
  UUID_PATTERN,
  mapSession,
  normalizeData,
} = require('./sessionMapping');
const { runTransaction } = require('./transaction');

// 여러 process가 동시에 배정해도 condition 균형이 깨지지 않도록 advisory lock을 공유한다.
const ASSIGNMENT_LOCK = 714080020;

async function createSession(pool, { fixedCondition, random }, { submissionKey, data } = {}) {
  return runTransaction(pool, async (client) => {
    await client.query('SELECT pg_advisory_xact_lock($1)', [ASSIGNMENT_LOCK]);
    if (submissionKey) {
      const existing = await client.query(
        'SELECT * FROM experiment_sessions WHERE submission_key = $1',
        [submissionKey],
      );
      if (existing.rowCount) {
        return mapSession(existing.rows[0]);
      }
    }

    const countsResult = await client.query(
      'SELECT condition, COUNT(*)::int AS count FROM experiment_sessions GROUP BY condition',
    );
    const counts = Object.fromEntries(CONDITIONS.map((condition) => [condition, 0]));
    for (const row of countsResult.rows) {
      counts[row.condition] = Number(row.count);
    }
    const condition = fixedCondition || chooseBalancedCondition(counts, random);
    const sessionId = randomUUID();
    const participantId = randomUUID();
    const assignmentMode = fixedCondition ? 'fixed' : 'balanced';
    const result = await client.query(
      `INSERT INTO experiment_sessions
        (session_id, participant_id, submission_key, condition, assignment_mode, data)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)
       RETURNING *`,
      [
        sessionId,
        participantId,
        submissionKey || null,
        condition,
        assignmentMode,
        JSON.stringify(normalizeData(data)),
      ],
    );
    await client.query(
      'INSERT INTO session_events (session_id, event_type) VALUES ($1, $2)',
      [sessionId, 'session_created'],
    );
    return mapSession(result.rows[0]);
  });
}

async function getSession(pool, sessionId) {
  if (typeof sessionId !== 'string' || !UUID_PATTERN.test(sessionId)) {
    return null;
  }
  const result = await pool.query(
    'SELECT * FROM experiment_sessions WHERE session_id = $1',
    [sessionId],
  );
  return mapSession(result.rows[0]);
}

async function updateSession(pool, sessionId, { condition, data = {} } = {}) {
  if (condition !== undefined) {
    throw new Error('condition is immutable');
  }
  const result = await pool.query(
    `UPDATE experiment_sessions
     SET data = data || $2::jsonb
     WHERE session_id = $1
     RETURNING *`,
    [sessionId, JSON.stringify(normalizeData(data))],
  );
  if (!result.rowCount) {
    throw new Error('unknown session');
  }
  return mapSession(result.rows[0]);
}

module.exports = { createSession, getSession, updateSession };
