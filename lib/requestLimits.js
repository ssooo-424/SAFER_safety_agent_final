function assertPositiveInteger(value, name) {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
}

function createFixedWindowLimiter({
  windowMs,
  maxPerKey,
  maxGlobal,
  maxKeys = 10_000,
  now = Date.now,
}) {
  // key별 bucket과 global bucket을 함께 적용해 특정 client와 전체 처리량을 각각 제한한다.
  assertPositiveInteger(windowMs, 'windowMs');
  assertPositiveInteger(maxPerKey, 'maxPerKey');
  assertPositiveInteger(maxGlobal, 'maxGlobal');
  assertPositiveInteger(maxKeys, 'maxKeys');
  if (typeof now !== 'function') {
    throw new Error('now must be a function');
  }

  const buckets = new Map();
  let globalBucket = { count: 0, startedAt: now() };

  function currentBucket(bucket, timestamp) {
    if (!bucket || timestamp - bucket.startedAt >= windowMs) {
      return { count: 0, startedAt: timestamp };
    }
    return bucket;
  }

  function rejected(bucket, timestamp) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.startedAt + windowMs - timestamp) / 1_000)),
    };
  }

  function consume(key) {
    const timestamp = now();
    if (!Number.isFinite(timestamp)) {
      throw new Error('now must return a finite timestamp');
    }

    globalBucket = currentBucket(globalBucket, timestamp);
    if (globalBucket.count >= maxGlobal) {
      return rejected(globalBucket, timestamp);
    }

    const normalizedKey = String(key || 'unknown');
    let bucket = currentBucket(buckets.get(normalizedKey), timestamp);
    if (!buckets.has(normalizedKey) && buckets.size >= maxKeys) {
      for (const [storedKey, storedBucket] of buckets) {
        if (timestamp - storedBucket.startedAt >= windowMs) {
          buckets.delete(storedKey);
        }
      }
      if (buckets.size >= maxKeys) {
        return rejected(globalBucket, timestamp);
      }
    }
    if (bucket.count >= maxPerKey) {
      return rejected(bucket, timestamp);
    }

    bucket.count += 1;
    globalBucket.count += 1;
    buckets.set(normalizedKey, bucket);
    return { allowed: true };
  }

  return { consume };
}

function createConcurrencyGate({ maxActive }) {
  // 이 gate는 프로세스 내부 활성 작업만 제한하므로 인스턴스 간 제한에는 사용하지 않는다.
  assertPositiveInteger(maxActive, 'maxActive');
  let active = 0;

  function tryAcquire() {
    if (active >= maxActive) {
      return { allowed: false };
    }

    active += 1;
    let released = false;
    return {
      allowed: true,
      release() {
        if (!released) {
          released = true;
          active -= 1;
        }
      },
    };
  }

  return { tryAcquire };
}

module.exports = {
  createConcurrencyGate,
  createFixedWindowLimiter,
};
