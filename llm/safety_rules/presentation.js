// report, bubble, prompt의 punctuation은 각 caller가 소비하는 public contract다.
const { cleanRuleAction } = require("./normalization");

function buildRuleComment(action = "", triggerCode = "", category = "") {
  const triggerLead = {
    T1: "일정에 쫓길수록 이 확인을 생략하지 않는 것이 중요합니다.",
    T2: "늘 하던 작업이라도 오늘의 설치·체결 상태는 다시 확인해야 합니다.",
    T3: "잠깐 불편하더라도 보호구와 절차를 건너뛰지 않는 것이 중요합니다.",
    T4: "혼자 판단하지 말고 신호와 공유를 통해 위험을 확인해야 합니다.",
    T5: "비켜갈 수 있다고 판단하기보다 위험구역과 통로 상태를 먼저 정리해야 합니다.",
    T6: "보이지 않는 사각지대가 있을 수 있으므로 이동 전 주변을 다시 확인해야 합니다.",
    T7: "피로할수록 평소보다 확인 절차를 더 천천히 반복해야 합니다."
  };
  const categoryMsg = {
    PPE: "보호구와 체결 상태는 사고 피해를 줄이는 마지막 안전장치입니다.",
    FALL_PROTECTION: "추락 방호조치가 갖춰져 있어야 작업 위치의 위험을 줄일 수 있습니다.",
    FALLING_OBJECT: "낙하·전도 방지조치가 있어야 자재와 공구 위험이 작업자에게 이어지지 않습니다.",
    ACCESS_CONTROL: "위험구역을 구분하고 들어가지 않는 행동이 2차 피해를 막습니다.",
    SIGNAL_COMMUNICATION: "신호와 의사소통이 맞지 않으면 작은 이동도 사고로 이어질 수 있습니다.",
    HOUSEKEEPING: "정리정돈은 넘어짐·낙하·협착 위험을 줄이는 기본 조건입니다.",
    ELECTRICAL: "전기작업에서는 차단·점검·절연 확인이 사고를 막는 핵심입니다.",
    VENTILATION_GAS: "환기와 농도 확인은 보이지 않는 질식·가스 위험을 막는 핵심 절차입니다.",
    FIRE_EXPLOSION: "화기 작업에서는 불티·가연물·소화기 상태를 확인해야 화재와 화상을 막을 수 있습니다.",
    MACHINE_GUARDING: "회전부와 방호덮개 상태를 확인해야 끼임과 절단 사고를 막을 수 있습니다.",
    WORK_PLAN: "작업 전 순서와 기준을 확인해야 급한 판단으로 절차가 생략되지 않습니다.",
    EDUCATION_MANAGEMENT: "알고 있는 절차도 작업 직전에 다시 확인해야 실제 행동으로 이어집니다.",
    EQUIPMENT: "장비 주변에서는 작업반경과 장비 상태를 확인해야 충돌·끼임 위험을 줄일 수 있습니다.",
    GENERAL: "작업 전 이 수칙을 확인하는 것만으로도 사고 가능성을 낮출 수 있습니다."
  };
  const a = triggerLead[triggerCode] || "작업 전 이 수칙을 확인하는 것이 중요합니다.";
  const b = categoryMsg[category] || categoryMsg.GENERAL;
  return a === b ? a : `${a} ${b}`;
}

function buildScenarioRulesForReport(rules = []) {
  return rules.map((rule, idx) => {
    let line = `${idx + 1}. ${cleanRuleAction(rule.action)}`;
    if (rule.comment) line += `\n   → ${rule.comment}`;
    return line;
  }).join("\n\n");
}

function buildScenarioRulesBubbles(rules = []) {
  const ordinals = ["첫째", "둘째", "셋째"];
  const bubbles = [];
  rules.slice(0, 3).forEach((rule, idx) => {
    bubbles.push(`"${ordinals[idx]}, ${cleanRuleAction(rule.action)}."`);
    bubbles.push(rule.comment ? `"${rule.comment}"` : `"이 수칙은 사고를 막는 데 꼭 필요해."`);
  });
  return bubbles.join(" ||| ");
}

function formatScenarioRulesForPrompt(rules = []) {
  const ordinals = ["첫째", "둘째", "셋째"];
  return rules.slice(0, 3).map((rule, idx) => {
    let text = `[수칙 ${idx + 1}]\n"${ordinals[idx]}, ${cleanRuleAction(rule.action)}."`;
    text += rule.comment
      ? `\n→ 이어서 별도 말풍선: "${rule.comment}"`
      : "\n→ 이어서 별도 말풍선: 이 수칙이 왜 중요한지 한 문장으로";
    return text;
  }).join("\n\n");
}

module.exports = {
  buildRuleComment,
  buildScenarioRulesForReport,
  buildScenarioRulesBubbles,
  formatScenarioRulesForPrompt
};
