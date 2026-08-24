const {
  assertRequestOrder,
  mapRequest,
  mapSession,
  nextPhase,
  normalizeData,
  validateLeaseGeneration,
  validateRequestInput,
} = require('./sessionMapping');
const { runTransaction } = require('./transaction');

// leaseGeneration을 SQL 조건에도 포함해야 stale worker가 새 owner의 결과를 덮어쓸 수 없다.
async function beginRequest(pool, clock, sessionId, request) {
  validateRequestInput(request);
  return runTransaction(pool, async (client) => {
    const sessionResult = await client.query(
      'SELECT * FROM experiment_sessions WHERE session_id = $1 FOR UPDATE',
      [sessionId],
    );
    const session = mapSession(sessionResult.rows[0]);
    if (!session) {
      throw new Error('unknown session');
    }
    const existingResult = await client.query(
      `SELECT * FROM session_requests
       WHERE session_id = $1 AND request_id = $2 FOR UPDATE`,
      [sessionId, request.requestId],
    );
    const existing = existingResult.rowCount ? mapRequest(existingResult.rows[0]) : null;
    if (existing && (existing.operation !== request.operation || existing.turn !== request.turn)) {
      throw new Error('requestId cannot be reused for another operation');
    }
    if (existing?.status === 'completed') {
      return existing;
    }
    if (existing?.status === 'started') {
      if (isStale(existing, clock)) {
        const startedAt = currentTime(clock.now);
        const restarted = await client.query(
          `UPDATE session_requests
           SET status = 'started', response = NULL, completed_at = NULL, started_at = $3,
               lease_generation = lease_generation + 1
           WHERE session_id = $1 AND request_id = $2 AND status = 'started'
             AND (started_at IS NULL OR started_at <= $4)
           RETURNING *`,
          [
            sessionId,
            request.requestId,
            startedAt,
            new Date(startedAt.getTime() - clock.requestLeaseMs),
          ],
        );
        if (restarted.rowCount) {
          return mapRequest(restarted.rows[0]);
        }
      }
      return { ...existing, status: 'pending' };
    }
    const pendingResult = await client.query(
      `SELECT 1 FROM session_requests
       WHERE session_id = $1 AND status = 'started' LIMIT 1`,
      [sessionId],
    );
    if (pendingResult.rowCount) {
      throw new Error('a request is already pending');
    }
    assertRequestOrder(session, request);
    const startedAt = currentTime(clock.now);
    if (existing) {
      await client.query(
        `UPDATE session_requests
         SET status = 'started', response = NULL, completed_at = NULL, started_at = $3,
             lease_generation = lease_generation + 1
         WHERE session_id = $1 AND request_id = $2`,
        [sessionId, request.requestId, startedAt],
      );
    } else {
      await client.query(
        `INSERT INTO session_requests
         (session_id, request_id, operation, turn, status, started_at, lease_generation)
         VALUES ($1, $2, $3, $4, 'started', $5, 1)`,
        [sessionId, request.requestId, request.operation, request.turn ?? null, startedAt],
      );
    }
    await client.query(
      'INSERT INTO session_events (session_id, request_id, event_type) VALUES ($1, $2, $3)',
      [sessionId, request.requestId, 'request_started'],
    );
    return {
      sessionId,
      requestId: request.requestId,
      operation: request.operation,
      turn: request.turn,
      status: 'started',
      leaseGeneration: existing ? existing.leaseGeneration + 1 : 1,
    };
  });
}

async function completeRequest(
  pool,
  sessionId,
  { requestId, leaseGeneration, response, sessionData } = {},
) {
  return runTransaction(pool, async (client) => {
    const sessionResult = await client.query(
      'SELECT * FROM experiment_sessions WHERE session_id = $1 FOR UPDATE',
      [sessionId],
    );
    const session = mapSession(sessionResult.rows[0]);
    if (!session) {
      throw new Error('unknown session');
    }
    const requestResult = await client.query(
      `SELECT * FROM session_requests
       WHERE session_id = $1 AND request_id = $2 FOR UPDATE`,
      [sessionId, requestId],
    );
    if (!requestResult.rowCount) {
      throw new Error('unknown request');
    }
    const request = mapRequest(requestResult.rows[0]);
    if (request.status === 'completed') {
      return request;
    }
    if (request.status !== 'started') {
      throw new Error('request is not pending');
    }
    validateLeaseGeneration(leaseGeneration);
    if (request.leaseGeneration !== leaseGeneration) {
      throw new Error('request lease generation has expired');
    }
    const dataPatch = normalizeData(sessionData);
    const phase = nextPhase(request);
    const completed = await client.query(
      `UPDATE session_requests
       SET status = 'completed', response = $3::jsonb, completed_at = now()
       WHERE session_id = $1 AND request_id = $2 AND status = 'started' AND lease_generation = $4
       RETURNING *`,
      [sessionId, requestId, JSON.stringify(response ?? null), leaseGeneration],
    );
    if (!completed.rowCount) {
      throw new Error('request lease generation has expired');
    }
    await client.query(
      `UPDATE experiment_sessions
       SET data = data || $4::jsonb, phase = $2, next_turn = $3
       WHERE session_id = $1`,
      [sessionId, phase.phase, phase.nextTurn ?? session.nextTurn, JSON.stringify(dataPatch)],
    );
    await client.query(
      'INSERT INTO session_events (session_id, request_id, event_type) VALUES ($1, $2, $3)',
      [sessionId, requestId, 'request_completed'],
    );
    return mapRequest(completed.rows[0]);
  });
}

async function failRequest(pool, sessionId, { requestId, leaseGeneration } = {}) {
  const result = await pool.query(
    `UPDATE session_requests SET status = 'failed'
     WHERE session_id = $1 AND request_id = $2 AND status = 'started' AND lease_generation = $3
     RETURNING *`,
    [sessionId, requestId, leaseGeneration],
  );
  if (result.rowCount) {
    return mapRequest(result.rows[0]);
  }
  const existing = await pool.query(
    'SELECT * FROM session_requests WHERE session_id = $1 AND request_id = $2',
    [sessionId, requestId],
  );
  if (!existing.rowCount) {
    throw new Error('unknown request');
  }
  const request = mapRequest(existing.rows[0]);
  if (request.status === 'started') {
    validateLeaseGeneration(leaseGeneration);
    if (request.leaseGeneration !== leaseGeneration) {
      throw new Error('request lease generation has expired');
    }
  }
  return request;
}

function currentTime(now) {
  const value = now();
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error('now must return a valid time');
  }
  return date;
}

function isStale(request, { requestLeaseMs, now }) {
  const startedAt = new Date(request.startedAt);
  return (
    Number.isNaN(startedAt.getTime()) ||
    currentTime(now).getTime() - startedAt.getTime() > requestLeaseMs
  );
}

module.exports = { beginRequest, completeRequest, failRequest };
