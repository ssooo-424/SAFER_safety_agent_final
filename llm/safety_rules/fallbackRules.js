// scenario measure가 부족해도 기존 3개 수칙 contract를 채우기 위한 정책이다.
const { classifyRuleCategory, getTriggerCode } = require("./classification");
const { normalizeRiskType } = require("./normalization");
const { buildRuleComment } = require("./presentation");

function fallbackRules({ riskType, triggers }) {
  const riskKey = normalizeRiskType(riskType);
  const triggerCode = getTriggerCode(triggers);
  const riskActions = {
    추락: "안전대를 안전난간·생명줄에 체결하고 작업발판·개구부 덮개 상태를 먼저 확인한다",
    끼임: "기계·설비의 전원을 차단하고 잠금 조치 후 협착 위험 구간에 접근한다",
    낙하: "상부 자재·공구의 결속과 낙하물방지망을 확인하고 위험 반경 아래 출입을 통제한다",
    충돌: "장비 이동 동선과 작업 구역을 분리하고 신호수 배치와 접근 경고를 확인한다",
    붕괴: "구조물·거푸집·흙막이의 고정과 지지 상태를 확인하고 전도 위험 구간을 통제한다",
    감전: "작업 전 전원을 차단하고 검전기로 무전압을 확인한 뒤 절연 보호구를 착용한다",
    질식: "밀폐공간 진입 전 산소·유해가스 농도를 측정하고 환기와 감시인 배치를 확인한다",
    익사: "물가·수상 작업 시 구명조끼를 착용하고 빠짐 방지 안전난간을 확인한다",
    절상: "절단 공구 사용 전 방호덮개와 보호구 착용 상태를 확인한다",
    넘어짐: "작업 전 이동통로와 바닥 상태를 확인하고 미끄럼 위험 구간을 정리한다"
  };
  const triggerActions = {
    T1: ["작업 전 10초 멈추고 작업 순서와 위험요인을 다시 확인한다", "빨리 끝내려는 마음이 들수록 표준 작업 절차를 생략하지 않는다"],
    T2: ["늘 하던 작업이라도 오늘의 안전장치와 보호구 상태를 다시 확인한다", "익숙하다는 이유로 잠금장치나 체결 상태 확인을 생략하지 않는다"],
    T3: ["불편하더라도 규정된 보호구를 착용하고 체결 상태를 확인한다", "짧은 작업이라도 보호구와 안전절차를 예외 없이 지킨다"],
    T4: ["작업 전 신호수와 신호 방법을 확인하고 약속된 신호에 따라 이동한다", "작업 지시를 받을 때는 복명복창으로 서로의 의도를 확인한다"],
    T5: ["작업 전 통로와 발판 위 자재를 정리하고 장애물을 제거한다", "위험구역과 이동통로가 구분되어 있는지 확인한다"],
    T6: ["장비 이동 전 사각지대와 작업반경 안에 사람이 없는지 확인한다", "보행자는 장비 회전반경 안에 들어가지 않고 안전거리를 유지한다"],
    T7: ["피로하거나 집중력이 떨어질수록 작업 전 확인 절차를 천천히 반복한다", "컨디션이 급격히 저하되면 즉시 관리자에게 알리고 휴식한다"]
  };
  const base = [];
  if (riskActions[riskKey]) {
    const action = riskActions[riskKey];
    base.push({ action, category: classifyRuleCategory(action), source: "fallback" });
  }
  for (const action of triggerActions[triggerCode] || []) {
    base.push({ action, category: classifyRuleCategory(action), source: "fallback" });
  }
  const defaults = [
    "작업 시작 전 위험 요인을 스스로 확인하고 필요한 안전대책을 먼저 세운다",
    "불안전한 상태를 발견하면 즉시 작업을 멈추고 시정 조치를 요청한다",
    "작업 중 위험하다고 느껴지는 상황은 혼자 판단하지 말고 관리자에게 알린다"
  ];
  for (const action of defaults) {
    if (base.length >= 3) break;
    base.push({ action, category: classifyRuleCategory(action), source: "fallback" });
  }
  return base.slice(0, 3).map((rule, idx) => ({
    ...rule,
    comment: buildRuleComment(rule.action, triggerCode, rule.category),
    order: idx + 1
  }));
}

module.exports = { fallbackRules };
