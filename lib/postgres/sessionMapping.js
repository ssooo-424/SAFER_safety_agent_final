const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// DB row 변환과 boundary validation을 공유해야 CRUD와 request 경로의 형식이 어긋나지 않는다.
function parseJson(value) {
  if (!value) {
    return {};
  }
  return typeof value === 'string' ? JSON.parse(value) : value;
}

function normalizeData(data) {
  if (data === undefined) {
    return {};
  }
  if (!data || Array.isArray(data) || typeof data !== 'object') {
    throw new Error('session data must be an object');
  }
  return data;
}

function mapSession(row) {
  if (!row) {
    return null;
  }
  return {
    sessionId: row.session_id,
    participantId: row.participant_id,
    condition: row.condition,
    assignmentMode: row.assignment_mode,
    data: parseJson(row.data),
    phase: row.phase,
    nextTurn: Number(row.next_turn),
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function mapRequest(row) {
  return {
    sessionId: row.session_id,
    requestId: row.request_id,
    operation: row.operation,
    turn: row.turn === null ? undefined : Number(row.turn),
    status: row.status,
    leaseGeneration: Number(row.lease_generation),
    ...(row.started_at ? { startedAt: new Date(row.started_at).toISOString() } : {}),
    ...(row.response === null || row.response === undefined
      ? {}
      : { response: parseJson(row.response) }),
  };
}

function validateRequestInput({ requestId, operation, turn }) {
  if (!requestId || typeof requestId !== 'string') {
    throw new Error('requestId is required');
  }
  if (!['start', 'intro', 'chat', 'post'].includes(operation)) {
    throw new Error('unsupported request operation');
  }
  if (operation === 'chat' && (!Number.isInteger(turn) || turn < 4 || turn > 6)) {
    throw new Error('chat turn must be an integer from 4 to 6');
  }
  if (operation !== 'chat' && turn !== undefined) {
    throw new Error('only chat requests may specify a turn');
  }
}

function validateLeaseGeneration(leaseGeneration) {
  if (!Number.isInteger(leaseGeneration) || leaseGeneration < 1) {
    throw new Error('lease generation is required');
  }
}

function assertRequestOrder(session, { operation, turn }) {
  if (operation === 'start' && session.phase !== 'created') {
    throw new Error('request is out of order');
  }
  if (operation === 'intro' && session.phase !== 'started') {
    throw new Error('request is out of order');
  }
  if (operation === 'post' && session.phase !== 'turn_6_completed') {
    throw new Error('request is out of order');
  }
  if (
    operation === 'chat' &&
    (session.phase !== 'intro_completed' && !session.phase.startsWith('turn_'))
  ) {
    throw new Error('request is out of order');
  }
  if (operation === 'chat' && turn !== session.nextTurn) {
    throw new Error('request is out of order');
  }
}

function nextPhase(request) {
  if (request.operation === 'start') {
    return { phase: 'started', nextTurn: 4 };
  }
  if (request.operation === 'intro') {
    return { phase: 'intro_completed', nextTurn: 4 };
  }
  if (request.operation === 'post') {
    return { phase: 'completed' };
  }
  return { phase: `turn_${request.turn}_completed`, nextTurn: request.turn + 1 };
}

module.exports = {
  UUID_PATTERN,
  assertRequestOrder,
  mapRequest,
  mapSession,
  nextPhase,
  normalizeData,
  validateLeaseGeneration,
  validateRequestInput,
};
