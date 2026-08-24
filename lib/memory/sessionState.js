function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeData(data) {
  if (data === undefined) {
    return {};
  }
  if (!data || Array.isArray(data) || typeof data !== 'object') {
    throw new Error('session data must be an object');
  }
  return clone(data);
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
    return { phase: 'started' };
  }
  if (request.operation === 'intro') {
    return { phase: 'intro_completed' };
  }
  if (request.operation === 'post') {
    return { phase: 'completed' };
  }
  return {
    phase: `turn_${request.turn}_completed`,
    nextTurn: request.turn + 1,
  };
}

module.exports = {
  clone,
  normalizeData,
  validateRequestInput,
  assertRequestOrder,
  nextPhase,
};
