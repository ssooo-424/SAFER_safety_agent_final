const {
  buildScenarioBasedSafetyRulesFromPayload,
  formatScenarioRulesForPrompt
} = require("../safetyRulesEngine");
const {
  getInjuryContext,
  getProcessText,
  getTimeGreeting,
  joinSafe,
  summarizeContext
} = require("./personaContext");
const { buildChatStageGuides } = require("./chatStageGuides");

function buildC3System(payload, scenarioId, branch, stage) {
  const ctx = summarizeContext(payload, scenarioId);
  const p = payload.profile || payload.userInfo || {};
  const i = payload.incident || {};

  const name = p.name || "OO";
  const who = p.importantPerson || "가족";
  const whoDetail = p.importantPersonDetail || "";
  const riskType = i.riskType || "";
  const triggers = joinSafe(i.triggers, ", ");
  const scenario = i.sentence || "";
  const feeling = i.feeling || "";
  const spokenJob = (Array.isArray(p.jobType) ? p.jobType[0] : p.jobType) || "작업자";
  const processText = getProcessText(i);
  const spokenProcess = i.detailProcess || i.majorProcess || processText;
  const workContent = i.processContent || processText;
  const injury = getInjuryContext(riskType);
  const timeGreeting = getTimeGreeting();
  const scenarioRulesResult = buildScenarioBasedSafetyRulesFromPayload(payload);
  const rules = scenarioRulesResult.rules;
  const rulesText = formatScenarioRulesForPrompt(rules);

  console.log(
   `✅ [C3 안전수칙] source=${scenarioRulesResult.source}, measures=${scenarioRulesResult.measuresCount}, rules=${rules.length}`
  );

  const splitInstruction = `
[형식 규칙: 말풍선 나누기]
- 2~3문장 이상 길어지면, 문맥에 따라 '|||' 기호를 넣어라.
- '|||'가 있는 곳에서 말풍선이 나뉜다.
- 예시: "안녕. ||| 반가워."
  `.trim();

  const { stageGuide, quickReplyGuide } = buildChatStageGuides({
    stage,
    branch,
    name,
    spokenJob,
    spokenProcess,
    triggers,
    feeling,
    scenario,
    injury,
    who,
    whoDetail,
    workContent,
    rules,
    timeGreeting
  });

  return `
너는 "3년 뒤의 나(미래자아)"다.
지금의 나(사용자)와 채팅한다.

${splitInstruction}

[🚨 대화 진행 절대 규칙]
1. 무조건 아래 제시된 '현재 단계(Stage ${stage}) 목표'로 대화 주제를 전환하고 해당 내용을 진행해야 합니다.

규칙:
- ${branch === 'Go' ? '후회와 진심 어린 호소' : '자부심과 격려'}의 톤.
- 메타 발언 금지.
- 페르소나 유형 코드(FA/DA/IC/IR)나 진단명을 사용자에게 직접 언급하지 말 것.
- "너는 ~한 사람이야" 같은 단정 금지, "누구나 그렇지" 같은 일반화 금지.
- ⚠️ 시나리오 속 '작업자'는 제3자가 아니라 사용자 본인(과거의 나)이다.
  시나리오 상황을 언급할 때 절대 "작업자가", "그 작업자는" 같은 3인칭을 쓰지 말고,
  반드시 "네가", "너가", "너는"으로 변환해서 말할 것.
  (예: "작업자가 방수 작업 중 추락한다" → "네가 방수 작업 하다가 떨어질 뻔했잖아")

현재 단계(Stage ${stage}) 목표:
${stageGuide}

${ctx}

[출력 형식: 무조건 JSON 형식으로 응답할 것]
{
  "botMessage": "(대답)",
  "quickReplies": ["(후보)"]
}
👉 🚨 퀵 리플라이 작성 지시사항:
${quickReplyGuide}
`.trim();
}

module.exports = { buildC3System };
