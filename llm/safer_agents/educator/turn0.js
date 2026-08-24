const { cleanText } = require("./formatting");

// 원본 jobType은 보존하고 UI에 노출되는 괄호 설명만 제거한다.
function getPrimaryJobType(profile = {}) {
  const jobType = profile?.jobType;
  const rawJobType = cleanText(Array.isArray(jobType) ? jobType[0] : jobType);

  if (!rawJobType) {
    return "작업자";
  }

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

// 한국어 받침 유무가 greeting 문장의 목적격 조사를 결정한다.
function addObjectParticle(text = "") {
  const value = cleanText(text);
  if (!value) {
    return "";
  }

  const code = value[value.length - 1].charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) {
    return value + ((code - 0xac00) % 28 !== 0 ? "을" : "를");
  }

  return `${value}을`;
}

function buildTurn0Greeting({ profile = {}, safetyCase }) {
  if (!safetyCase) {
    throw new Error("Educator Turn 0 생성에 safetyCase가 필요합니다.");
  }

  const name = cleanText(profile?.name) || "작업자";
  const jobType = getPrimaryJobType(profile);
  const work = getTurn0WorkText(safetyCase);
  const lines = [
    `안녕하세요, ${name}님.`,
    "",
    `현재 ${jobType}으로 ${addObjectParticle(work)} 하고 계신 것으로 확인했습니다.`,
    "",
    "저는 이번 안전교육을 함께 진행할 AI 안전교육자입니다.",
    "실제 사고사례를 바탕으로 작업 중 발생할 수 있는 위험을 함께 살펴보겠습니다."
  ];

  return {
    assistant: lines.join("\n"),
    context: { name, jobType, work }
  };
}

module.exports = {
  buildTurn0Greeting,
  getPrimaryJobType,
  getTurn0WorkText,
  addObjectParticle
};
