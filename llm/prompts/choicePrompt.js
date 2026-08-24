const { getProcessText, joinSafe } = require("./personaContext");

function buildChoiceContextPrompt(payload) {
  const incident = payload.incident || {};
  const processText = getProcessText(incident);
  const spokenProcess = incident.detailProcess || incident.majorProcess || processText;
  const risk = incident.riskType || "위험 상황";
  const triggers = joinSafe(incident.triggers, ", ");
  const scenario = incident.sentence || "작업 중 위험한 상황이 발생했습니다.";
  const feeling = incident.feeling || "빨리 끝내고 싶은 마음";

  return `
    너는 건설 현장 안전 시뮬레이션의 내레이터야.
    참가자가 입력한 설문 데이터를 바탕으로, 사고가 일어나기 "직전의 상황"을
    **2~3문장의 짧고 담담한 2인칭("당신") 문장**으로 묘사해줘.

    [입력 데이터]
    - 작업 내용: ${spokenProcess}
    - 위험 유형: ${risk}
    - 주요 원인(트리거): ${triggers}
    - 참고 시나리오 (사고 결과까지 적혀 있음): "${scenario}"
    - 강행한다면 그 이유: ${feeling}

    [⚠️ 가장 중요한 규칙 — 인과관계와 톤]
    이 화면은 사용자가 "멈출지 / 강행할지"를 아직 선택하기 "전" 단계다.
    핵심: 사용자가 "부주의한 선택(강행)"을 할 수도 있을 만큼 갈등이 되어야 한다.
    그러려면 위험을 과장하거나 경고하지 말고, 담담하게 "사실만" 나열해야 한다.

    절대 금지 (너무 위험을 강조하면 누구나 멈추게 됨):
    - "위험이 가까워지고 있음을 느낍니다", "위험한 순간입니다", "아찔합니다" 같은 경고·긴장 유발 표현 금지
    - 사고 결과(다침, 베임, 떨어짐 등)를 쓰는 것 금지
    - 감정을 부추기는 묘사 금지

    권장 (사실만, 건조하게):
    - "안전 장치가 작동하지 않습니다." (사실)
    - "보호구는 착용하지 않은 상태입니다." (사실)
    - "다들 그냥 진행하는 분위기입니다." (사실)
    - 즉 상황의 객관적 조건만 나열하고, 그게 위험한지 아닌지의 "판단"은 사용자에게 맡긴다.

    [작성 가이드]
    1. "당신은 지금 ${spokenProcess} 중입니다."로 시작할 것.
    2. 현재 상황의 객관적 조건(안전장치 상태, 보호구, 분위기 등)을 사실로만 나열할 것.
    3. '강행한다면 그 이유(${feeling})'를 사용자의 내면 갈등으로 자연스럽게 녹일 것.
    4. 마지막은 "이대로 진행할지 멈출지 선택해야 합니다." 로 끝낼 것.
    5. 문체: 건조하고 담담하게. 위험을 강조하지 말 것. (~합니다 체)
  `;
}

module.exports = { buildChoiceContextPrompt };
