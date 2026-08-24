// legacy measure schema의 순서와 첫 중복 제거 결과가 public output에 반영된다.
const { cleanRuleAction, normalizeText } = require("./normalization");

function extractMeasuresFromEntry(entry = {}) {
  const out = [];

  if (Array.isArray(entry.measures)) {
    entry.measures.forEach((m, idx) => {
      if (!m) return;
      if (typeof m === "string") {
        out.push({ raw: m, action: m, order: idx + 1 });
        return;
      }
      const action = m.displayAction || m.workerAction || m.scenarioLinkedAction ||
        m.scenario_linked_action || m.action || m.sentence || m.text || "";
      if (action) {
        out.push({ raw: m.raw || m.source || "", action, order: idx + 1, actionTags: m.actionTags || [] });
      }
    });
  }

  if (Array.isArray(entry.actions)) {
    entry.actions.forEach((a, idx) => {
      if (typeof a === "string") out.push({ raw: a, action: a, order: idx + 1 });
      else if (a?.action || a?.text) out.push({ raw: a.raw || "", action: a.action || a.text, order: idx + 1 });
    });
  }

  if (Array.isArray(entry.rules)) {
    entry.rules.forEach((r, idx) => {
      if (typeof r === "string") out.push({ raw: r, action: r, order: idx + 1 });
      else if (r?.action || r?.text) out.push({ raw: r.raw || "", action: r.action || r.text, order: idx + 1 });
    });
  }

  for (let i = 1; i <= 8; i++) {
    const action = entry[`AI 정제 대책 ${i}`] || entry[`AI 문장 대책 ${i}`] ||
      entry[`정제 대책 ${i}`] || entry[`안전대책 ${i}`];
    const raw = entry[`AI 원문구간 ${i}`] || entry[`원문구간 ${i}`] || "";
    if (action) out.push({ raw, action, order: i });
  }

  const singleAction = entry.scenarioLinkedAction || entry.scenario_linked_action ||
    entry.workerAction || entry.displayAction || entry.action;
  if (singleAction) out.push({ raw: entry.raw || "", action: singleAction, order: 1 });

  const seen = new Set();
  return out
    .map(m => ({ ...m, action: cleanRuleAction(m.action) }))
    .filter(m => {
      if (!m.action) return false;
      const key = normalizeText(m.action);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

module.exports = { extractMeasuresFromEntry };
