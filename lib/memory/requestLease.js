// leaseGeneration은 stale worker가 새 owner의 결과를 덮지 못하게 한다.
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

function assertLeaseGeneration(request, leaseGeneration) {
  validateLeaseGeneration(leaseGeneration);
  if (request.leaseGeneration !== leaseGeneration) {
    throw new Error('request lease generation has expired');
  }
}

function validateLeaseGeneration(leaseGeneration) {
  if (!Number.isInteger(leaseGeneration) || leaseGeneration < 1) {
    throw new Error('lease generation is required');
  }
}

module.exports = {
  assertLeaseGeneration,
  currentTime,
  isStale,
};
