// Turn 0의 deterministic 관계 소개를 다른 생성 lifecycle과 분리한다.
const { cleanText } = require("./shared");

function getPrimaryJobType(profile = {}) {
  const jobType = profile?.jobType;
  const rawJobType = Array.isArray(jobType)
    ? cleanText(jobType[0])
    : cleanText(jobType);
  if (!rawJobType) return "작업자";
  return rawJobType.replace(/\s*\([^)]*\)\s*/g, "").trim() || "작업자";
}

function getTurn0WorkText(safetyCase = {}) {
  const scenario = safetyCase.scenario || {};
  return (
    cleanText(scenario.detail_process) ||
    cleanText(scenario.process_content) ||
    cleanText(scenario.major_process) ||
    "현재 작업"
  );
}

function addObjectParticle(text = "") {
  const value = cleanText(text);
  if (!value) return "";
  const code = value[value.length - 1].charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) {
    return value + ((code - 0xac00) % 28 !== 0 ? "을" : "를");
  }
  return `${value}을`;
}

function buildTurn0Greeting({ profile = {}, safetyCase }) {
  if (!safetyCase) {
    throw new Error("Coworker Turn 0 생성에 safetyCase가 필요합니다.");
  }
  const name = cleanText(profile?.name) || "작업자";
  const jobType = getPrimaryJobType(profile);
  const work = getTurn0WorkText(safetyCase);
  const spokenWork = /작업$/.test(work) ? work : `${work} 작업`;
  const lines = [
    `안녕, ${name}.`,
    "",
    "나는 너랑 같은 현장에서 근무하던 작업자야.",
    "",
    `오늘 ${spokenWork}한다고 들었어.`
  ];
  return { assistant: lines.join("\n"), context: { name, jobType, work: spokenWork } };
}

module.exports = {
  buildTurn0Greeting,
  getPrimaryJobType,
  getTurn0WorkText,
  addObjectParticle
};
