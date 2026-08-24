const { PERSONA_LIB } = require("./personaContext");

const TRIGGER_TO_CODE = {
  "일정/생산 압박 (빨리빨리)": "T1",
  "반복 작업이라 익숙해서": "T2",
  "안전보호구/절차가 불편해서": "T3",
  "주변 동료들과의 의사소통 미흡": "T4",
  "작업 공간 협소/자재 정리 안됨": "T5",
  "위험이 눈에 잘 안 보여서": "T6",
  "피로/집중력 저하": "T7",
  "급박한 일정/압박": "T1",
  "반복·익숙함(늘 하던 일)": "T2",
  "안전보호구(PPE) 불편/귀찮음": "T3",
  "소통 부재/신호 혼선": "T4",
  "정리정돈 미흡/통로 장애": "T5",
  "시야 제한/사각지대": "T6",
  "야간·피로·집중저하": "T7"
};

const TRIGGER_KOSHA_ACTIONS = {
  "T1": [
    "작업 전 '10초 멈춤'으로 작업 순서를 재확인하기",
    "빨리 끝내는 것보다 안전하게 마치는 것이 우선임을 관리자와 공유하기",
    "독촉이 있을 때일수록 표준 작업 절차를 엄격히 준수하기"
  ],
  "T2": [
    "늘 하던 작업이라도 매일 안전 체크리스트를 새롭게 대조하기",
    "익숙함에 속아 생략했던 안전핀·잠금장치를 눈과 손으로 확인하기",
    "'설마 별일 있겠어'라는 생각이 들 때 가장 위험함을 인지하고 경계하기"
  ],
  "T3": [
    "불편하더라도 안전모 턱끈과 안전대 고리를 생명줄이라 생각하고 완벽히 착용하기",
    "작업 중 보호구가 흐트러지지 않았는지 동료와 서로 수시로 점검하기",
    "짧은 시간 작업이라도 예외 없이 규정된 보호구를 모두 착용하기"
  ],
  "T4": [
    "모든 중장비 작업 시 전담 신호수를 배치하고 약속된 신호만 사용하기",
    "작업 지시를 받을 때는 복명복창으로 서로의 의도를 명확히 확인하기",
    "주변 작업자와 간격이 좁을 때 육성으로 신호를 주고받은 뒤 이동하기"
  ],
  "T5": [
    "발판 위나 통로에 자재를 쌓아두지 않고 즉시 정리하기",
    "바닥의 기름기·수분·돌출된 못 등을 발견 즉시 제거하기",
    "작업 전후 5분간 주변 정리정돈을 습관화하기"
  ],
  "T6": [
    "사각지대가 발생하는 곳에 유도자를 배치하고 조명을 충분히 확보하기",
    "장비 운전자는 이동 전 주변에 사람이 없는지 360도 회전하며 직접 확인하기",
    "보행자는 장비의 회전 반경 내에 절대 진입하지 않고 안전 거리를 유지하기"
  ],
  "T7": [
    "집중력이 떨어지는 시간에 틈틈이 스트레칭하고 충분한 수분을 섭취하기",
    "피로도가 높을 때는 단독 작업을 피하고 2인 1조로 서로를 감시하기",
    "컨디션이 급격히 저하될 때 즉시 관리자에게 보고하고 휴식 시간을 갖기"
  ]
};

const RISK_KEY_ACTION = {
  "추락": "안전대를 안전난간·생명줄에 체결하고 작업발판·개구부 덮개 상태를 먼저 확인하기",
  "끼임": "기계·설비의 전원을 차단하고 잠금(LOTO) 후 회전부·협착 위험 구간에 접근하기",
  "낙하": "상부 자재·공구의 결속과 낙하물 방지망을 확인하고 위험 반경 아래 출입을 통제하기",
  "충돌": "장비 이동 동선과 작업 구역을 분리하고 신호수 배치·접근 경고를 확인하기",
  "붕괴": "구조물·거푸집·흙막이의 고정과 지지 상태를 점검하고 전도 위험 구간을 통제하기",
  "감전": "작업 전 전원을 차단하고 검전기로 무전압을 확인한 뒤 절연 보호구를 착용하기",
  "질식": "밀폐공간 진입 전 산소·유해가스 농도를 측정하고 환기·감시인을 배치하기",
  "익사": "물가·수상 작업 시 구명조끼를 착용하고 추락·빠짐 방지 안전난간을 확인하기"
};

function triggersToCodes(triggers = []) {
  return triggers.map(t => TRIGGER_TO_CODE[t]).filter(Boolean);
}

function normalizeRiskKey(riskType) {
  if (!riskType) return "";
  const value = String(riskType);
  if (value.includes("추락") || value.includes("떨어짐")) return "추락";
  if (value.includes("협착") || value.includes("끼임")) return "끼임";
  if (value.includes("낙하") || value.includes("비래") || value.includes("맞음")) return "낙하";
  if (value.includes("충돌") || value.includes("부딪힘")) return "충돌";
  if (value.includes("붕괴") || value.includes("전도") || value.includes("무너짐") || value.includes("넘어짐")) return "붕괴";
  if (value.includes("감전") || value.includes("화재")) return "감전";
  if (value.includes("질식")) return "질식";
  if (value.includes("익사") || value.includes("빠짐")) return "익사";
  return "";
}

function generateSafetyRules(triggers = [], profileCode = "", riskType = "") {
  const triggerCodes = triggersToCodes(triggers);
  const rules = [];
  const seenActions = new Set();
  const riskKey = normalizeRiskKey(riskType);

  // 사고유형에 직접 대응하는 행동이 일반 trigger 행동보다 우선해야 첫 수칙이 사고분류와 일치한다.
  if (riskKey && RISK_KEY_ACTION[riskKey]) {
    const riskAction = RISK_KEY_ACTION[riskKey];
    const persona = profileCode ? PERSONA_LIB[profileCode] : null;
    const phrases = persona?.sameKindPhrases || [];
    rules.push({
      action: riskAction,
      triggerCode: "RISK",
      persona: profileCode || null,
      sameKindPhrase: phrases.length > 0 ? phrases[0] : "",
      missingPoint: persona ? `'${riskKey}' 위험을 눈앞의 작업보다 먼저 보는 그 시선을` : ""
    });
    seenActions.add(riskAction);
  }

  for (const code of triggerCodes) {
    if (rules.length >= 3) break;
    const actions = TRIGGER_KOSHA_ACTIONS[code] || [];

    for (const action of actions) {
      if (rules.length >= 3) break;
      // 동일 action을 여러 trigger가 선택해도 사용자에게 같은 수칙을 반복하지 않는다.
      if (seenActions.has(action)) continue;

      // T6는 개인 성향이 아니라 환경 요인이므로 persona 해석을 적용하지 않는다.
      const persona = (code !== "T6" && profileCode) ? PERSONA_LIB[profileCode] : null;
      const phrases = persona?.sameKindPhrases || [];
      rules.push({
        action,
        triggerCode: code,
        persona: profileCode || null,
        sameKindPhrase: phrases.length > 0 ? phrases[rules.length % phrases.length] : "",
        missingPoint: persona?.missingPointByTrigger?.[code] || ""
      });
      seenActions.add(action);
    }
  }

  const defaults = [
    "작업 시작 전 위험 요인을 스스로 찾아내고 안전 대책 세우기",
    "내 몸은 내가 지킨다는 마음으로 안전 보호구를 올바르게 착용하기",
    "불안전한 상태를 발견하면 즉시 작업을 중단하고 시정 조치 요청하기"
  ];
  while (rules.length < 3) {
    const action = defaults.shift();
    if (!action) break;
    if (seenActions.has(action)) continue;
    rules.push({ action, triggerCode: null, persona: null, sameKindPhrase: "", missingPoint: "" });
    seenActions.add(action);
  }

  return rules.slice(0, 3);
}

module.exports = {
  generateSafetyRules,
  triggersToCodes,
  TRIGGER_TO_CODE,
  TRIGGER_KOSHA_ACTIONS
};
