const {
  buildScenarioBasedSafetyRulesFromPayload,
  buildScenarioRulesForReport
} = require("../safetyRulesEngine");
const { getInjuryContext, getProcessText, joinSafe } = require("./personaContext");

function buildC2Prompt(payload, scenarioId, branchChoice) {
  const p = payload.profile || payload.userInfo || {};
  const i = payload.incident || {};

  const name = p.name || "OO";
  const spokenJob = (Array.isArray(p.jobType) ? p.jobType[0] : p.jobType) || "작업자";
  const processText = getProcessText(i);
  const spokenProcess = i.detailProcess || i.majorProcess || processText;
  const triggers = joinSafe(i.triggers, ", ", "바쁘고 귀찮아서");
  const who = p.importantPerson || "가족";
  const whoDetail = p.importantPersonDetail || "";
  const riskType = i.riskType || "사고";
  const scenario = i.sentence || "";
  const injury = getInjuryContext(riskType);
  const isStop = (branchChoice === "Stop");
  const scenarioRulesResult = buildScenarioBasedSafetyRulesFromPayload(payload);
  const rules = scenarioRulesResult.rules;
  const rulesText = buildScenarioRulesForReport(rules);

  console.log(
    `✅ [C2 안전수칙] source=${scenarioRulesResult.source}, measures=${scenarioRulesResult.measuresCount}, rules=${rules.length}`
  );

  let narrativeGuide = "";

  if (isStop) {
    narrativeGuide = `
    [편지 작성 흐름: 안도와 행복 (Branch: Stop)]
    1. 도입: "안녕, 나는 3년 후의 ${name}(이)야. 요즘 ${spokenJob}으로 ${spokenProcess} 하느라 고생 많았어." 라고 따뜻하게 격려하며 시작.
    2. 상황 회상: 그날 사용자가 마주했던 위험 상황은 "${scenario}" (3인칭으로 적혀 있지만 '작업자' = 편지 받는 사용자 본인). 이 상황을 2인칭("네가 ~하다가")으로 변환해서 "그날 그런 위험한 상황을 마주했지만, '${triggers}' 같은 이유에 휘둘리지 않고 안전수칙을 확실히 이행해서 안전하게 작업을 마무리 했던거 기억나?" 라고 칭찬할 것.

       [🚨 어디까지 쓸지 — 가장 중요]
       위 시나리오 문장을 그대로 복사해서 쓰지 말 것. 반드시 자기 문장으로 다시 쓸 것.
       사고가 일어나기 '직전, 위험을 무릅쓸 뻔한 그 순간'까지만 회상시킨다.
       시나리오에 사고 결과(추락·균형상실·떨어짐·끼임·감전 등)가 적혀 있어도 그 결과 부분은 절대 쓰지 말 것.
       ❌ 금지(시나리오 복붙 + 3인칭 + 사고 결과): "작업자가 안전난간이 미설치된 발판 외측 단부에서 균형을 잃고 추락하는", "떨어질 뻔했지", "발을 헛디딜 뻔했어"
       ✅ 허용(2인칭 + 위험 조건까지만): "네가 안전난간도 없는 자리에서 작업해야 했잖아", "안전고리도 안 걸고 올라갈 뻔했잖아"
       ⚠️ "작업자가", "그 작업자는" 같은 3인칭 표현 절대 금지. 반드시 "네가/너는"으로.
    3. 결과(신체): 별일 없이 퇴근해서 씻고 시원한 물 한 잔 마시는 상쾌한 기분 묘사.
    4. 결과(가족): 주말에 ${who}와 함께 보내는 평범하지만 소중한 일상 묘사.
    5. 마무리 및 수칙 안내: "잠깐의 편함보다 미래를 생각하고 안전을 소중하게 여기는 행동으로 너는 현장에서도 안전수칙을 잘 지키는 근로자로 인정받았어. 네가 지켜냈던 아래 3가지 수칙을 앞으로도 잊지 마." 라고 말하며 편지 맨 마지막에 다음 3가지 수칙을 나열할 것.
    
    [안전수칙 3개 — 아래를 '1. 2. 3.' 번호와 함께 편지 맨 마지막에 그대로 출력할 것. '→'로 시작하는 설명 문장도 그대로 유지하고 바꾸거나 줄이지 말 것]
    ${rulesText}
    `;
  } else {
    narrativeGuide = `
    [편지 작성 흐름: 후회와 고통 (Branch: Go)]
    1. 도입: "안녕, 나는 3년 후의 ${name}(이)야. ${spokenJob}으로 ${spokenProcess} 하느라 고생 많겠네." (슬픈 어조, 회상하듯)
    2. 상황 회상: 그날 사용자가 마주했던 위험 상황은 "${scenario}" (3인칭으로 적혀 있지만 '작업자' = 편지 받는 사용자 본인). 이 상황을 2인칭("네가 ~하다가")으로 변환해서 "그날 그런 상황에서 '${triggers}' 같은 핑계로 안전수칙을 무시했던 게 너무 후회돼." 라고 자책할 것.

       [🚨 어디까지 쓸지 — 가장 중요]
       위 시나리오 문장을 그대로 복사해서 쓰지 말 것. 반드시 자기 문장으로 다시 쓸 것.
       이 단계에서는 사고가 일어나기 '직전, 위험을 무릅쓴 행동/선택'까지만 쓴다.
       시나리오에 사고 결과(추락·균형상실·떨어짐·끼임·감전 등)가 적혀 있어도 그 결과 묘사는 여기서 쓰지 말 것.
       (다친 결과는 3번에서 다루므로, 2번에서 미리 사고 장면을 재현하면 중복된다.)
       ❌ 금지(시나리오 복붙 + 3인칭 + 사고 장면 재현): "작업자가 안전난간이 미설치된 발판 외측 단부에서 균형을 잃고 추락하는 그 순간", "몸의 중심이 흔들리며 떨어지면서", "발을 헛디뎌"
       ✅ 허용(2인칭 + 위험한 선택까지만): "네가 안전난간도 없는 발판 바깥쪽에서 작업했잖아", "안전고리도 안 걸고 그냥 올라갔잖아"
       ⚠️ "작업자가", "그 작업자는" 같은 3인칭 표현 절대 금지. 반드시 "네가/너는"으로.
    3. 결과(신체): 그 선택으로 인해 지금 ${injury.part}를 다쳐 ${injury.symptom} 상태로 고통받는 현실 묘사. 밥 먹고 씻는 평범한 일상조차 어렵게 되었음.
    4. 결과(가족): ${who}에게 평범한 일상을 함께하지 못하는 상황이 후회됨. 그리고 항상 아픈 나를 보면서 속상해 하는 ${whoDetail}에게 미안한 심정.
    5. 현실: 병원비와 생계 걱정, 다시는 일을 못 한다는 막막함 토로.
    6. 깨달음(가치 전환): 잃고 나서야 알게 된 것을 담담히 전할 것. 
       "지금 네가 평범하고 당연하게 여기는 그 일상보다 소중한 건 없다"는 깨달음을 
       구체적인 일상 장면(출근길, 퇴근 후 씻는 것, ${who}와 밥 먹는 것 등)에 빗대어 말할 것. 
       이어서 "'${triggers}' 같은 이유로 조금 더 빨리 끝내려다, 늘 하던 일이라 익숙하다는 이유로 
       안전수칙을 놓치는 그 잠깐이 이 모든 걸 앗아간다"는 점을 짚을 것. 
       ⚠️ 훈계조("~해야 한다")가 아니라, 먼저 겪은 사람이 담담히 알려주는 어조로 쓸 것.
    7. 희망적 행동 촉구 및 수칙 안내 (결론): "하지만 3년 전의 너에게는 아직 이 끔찍한 미래를 바꿀 기회가 있어. 지금 당장 아래의 3가지 안전수칙을 지킨다면, 나와 같은 고통을 피하고 사랑하는 가족과의 소중한 일상을 지켜낼 수 있을 거야." 라고 당부할 것. (⚠️ "꼭 살아남아줘" 같은 극단적이고 과하게 부정적인 표현은 절대 쓰지 말 것). 그리고 편지 맨 마지막에 반드시 다음 3가지 수칙을 나열할 것.

    [안전수칙 3개 — 아래를 '1. 2. 3.' 번호와 함께 편지 맨 마지막에 그대로 출력할 것. '→'로 시작하는 설명 문장도 그대로 유지하고 바꾸거나 줄이지 말 것]
    ${rulesText}
    `;
  }

  return `
    당신은 3년 후의 '${name}'(미래자아)입니다.
    3년 전(현재)의 나에게 보내는 편지를 작성하세요.
    
    [형식 가이드]
    - 수신인: "To. ${name}" 으로 시작할 것.
    - 분량: 편지 본문 ${isStop ? '450~600자' : '550~700자'} (맨 마지막 안전수칙 3개는 이 분량에 포함하지 않음)
    - 말투: ${isStop ? '행복하고 다정한' : '처절하고 간곡한'} 어조 유지.

    ${narrativeGuide}

    [페르소나 표현 작성 시 절대 규칙]
    - 페르소나 유형 코드(FA/DA/IC/IR)나 진단명을 사용자에게 직접 언급하지 말 것
    - "너는 ~한 사람이야" 같은 단정 금지
    - "누구나 그렇지" 같은 일반화 금지
    - 가이드의 표현을 직접 인용하지 말고 자연스럽게 재구성할 것
  `;
}

module.exports = { buildC2Prompt };
