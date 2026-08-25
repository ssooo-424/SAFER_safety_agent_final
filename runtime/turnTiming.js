const TIMING_STAGES = [
  'turn0',
  'turn1',
  'turn2',
  'turn3',
  'organizational_outcome',
  'turn4',
  'turn5',
  'turn6',
];

const MAX_STAGE_MS = 4 * 60 * 60 * 1000;

function boundedMilliseconds(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > MAX_STAGE_MS) return null;
  return Math.round(number);
}

function safeTimestamp(value) {
  const text = String(value || '').trim();
  if (!text || Number.isNaN(Date.parse(text))) return '';
  return new Date(text).toISOString();
}

function normalizeTurnTimings(value) {
  if (!value || Array.isArray(value) || typeof value !== 'object') return {};
  const result = {};
  for (const stage of TIMING_STAGES) {
    const source = value[stage];
    if (!source || Array.isArray(source) || typeof source !== 'object') continue;
    const activeMs = boundedMilliseconds(source.activeMs);
    const totalMs = boundedMilliseconds(source.totalMs);
    const hiddenMs = boundedMilliseconds(source.hiddenMs);
    if (activeMs === null || totalMs === null || hiddenMs === null) continue;
    if (activeMs > totalMs || hiddenMs > totalMs) continue;
    result[stage] = {
      activeMs,
      totalMs,
      hiddenMs,
      startedAt: safeTimestamp(source.startedAt),
      completedAt: safeTimestamp(source.completedAt),
      completionAction: String(source.completionAction || '').trim().slice(0, 40),
    };
  }
  return result;
}

module.exports = { MAX_STAGE_MS, TIMING_STAGES, normalizeTurnTimings };
