const { buildExportRow } = require('./sessionRows');

const EXPORT_LOCK_ID = 714080021;

function parseData(value) {
  if (!value) return {};
  return typeof value === 'string' ? JSON.parse(value) : value;
}

async function readCompletedSessions(client) {
  const result = await client.query(`
    SELECT
      sessions.participant_id,
      sessions.condition,
      sessions.assignment_mode,
      sessions.phase,
      sessions.data,
      sessions.created_at,
      post.completed_at
    FROM experiment_sessions AS sessions
    LEFT JOIN LATERAL (
      SELECT completed_at
      FROM session_requests
      WHERE session_id = sessions.session_id
        AND operation = 'post'
        AND status = 'completed'
      ORDER BY completed_at DESC
      LIMIT 1
    ) AS post ON true
    WHERE sessions.phase = 'completed'
    ORDER BY sessions.created_at, sessions.participant_id
  `);
  return result.rows.map((row) => ({
    participantId: row.participant_id,
    condition: row.condition,
    assignmentMode: row.assignment_mode,
    phase: row.phase,
    data: parseData(row.data),
    createdAt: row.created_at,
    completedAt: row.completed_at,
  }));
}

async function exportCompletedSessions({ pool, gateway }) {
  const client = await pool.connect();
  let locked = false;
  try {
    const lockResult = await client.query(
      'SELECT pg_try_advisory_lock($1) AS locked',
      [EXPORT_LOCK_ID],
    );
    locked = Boolean(lockResult.rows[0]?.locked);
    if (!locked) throw new Error('another Google Sheets export is already running');
    const sessions = await readCompletedSessions(client);
    return await gateway.upsertRows(sessions.map(buildExportRow));
  } finally {
    try {
      if (locked) {
        await client.query('SELECT pg_advisory_unlock($1) AS unlocked', [EXPORT_LOCK_ID]);
      }
    } finally {
      client.release();
    }
  }
}

module.exports = { EXPORT_LOCK_ID, exportCompletedSessions, readCompletedSessions };
