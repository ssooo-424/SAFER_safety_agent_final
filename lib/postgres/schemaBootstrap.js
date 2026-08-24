// 기존 배포의 column을 순차 보정해야 재시작 중에도 schema migration이 안전하다.
async function bootstrapSchema(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS experiment_sessions (
      session_id UUID PRIMARY KEY,
      participant_id UUID NOT NULL UNIQUE,
      submission_key TEXT UNIQUE,
      condition TEXT NOT NULL CHECK (condition IN ('educator', 'coworker', 'future_self')),
      assignment_mode TEXT NOT NULL CHECK (assignment_mode IN ('fixed', 'balanced')),
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      phase TEXT NOT NULL DEFAULT 'created',
      next_turn INTEGER NOT NULL DEFAULT 4,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS session_requests (
      session_id UUID NOT NULL REFERENCES experiment_sessions(session_id) ON DELETE CASCADE,
      request_id TEXT NOT NULL,
      operation TEXT NOT NULL CHECK (operation IN ('start', 'intro', 'chat', 'post')),
      turn INTEGER,
      status TEXT NOT NULL CHECK (status IN ('started', 'completed', 'failed')),
      started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      lease_generation INTEGER NOT NULL DEFAULT 1,
      response JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      completed_at TIMESTAMPTZ,
      PRIMARY KEY (session_id, request_id)
    )
  `);
  await pool.query(
    'ALTER TABLE session_requests ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ',
  );
  await pool.query(
    'UPDATE session_requests SET started_at = created_at WHERE started_at IS NULL',
  );
  await pool.query(
    'ALTER TABLE session_requests ALTER COLUMN started_at SET DEFAULT now()',
  );
  await pool.query(
    'ALTER TABLE session_requests ALTER COLUMN started_at SET NOT NULL',
  );
  await pool.query(
    'ALTER TABLE session_requests ADD COLUMN IF NOT EXISTS lease_generation INTEGER',
  );
  await pool.query(
    'UPDATE session_requests SET lease_generation = 1 WHERE lease_generation IS NULL OR lease_generation < 1',
  );
  await pool.query(
    'ALTER TABLE session_requests ALTER COLUMN lease_generation SET DEFAULT 1',
  );
  await pool.query(
    'ALTER TABLE session_requests ALTER COLUMN lease_generation SET NOT NULL',
  );
  await pool.query(
    'ALTER TABLE session_requests DROP CONSTRAINT IF EXISTS session_requests_operation_check',
  );
  await pool.query(`
    ALTER TABLE session_requests
    ADD CONSTRAINT session_requests_operation_check
    CHECK (operation IN ('start', 'intro', 'chat', 'post'))
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS session_events (
      event_id BIGSERIAL PRIMARY KEY,
      session_id UUID NOT NULL REFERENCES experiment_sessions(session_id) ON DELETE CASCADE,
      request_id TEXT,
      event_type TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

module.exports = { bootstrapSchema };
