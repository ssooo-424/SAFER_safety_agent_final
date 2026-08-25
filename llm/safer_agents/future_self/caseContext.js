// WHY: INDEX가 선택한 실제 사고 행을 prompt에 넣는 형식을 한 concept로 고정한다.
const educatorAgent =
  require("../educator");

const {
  cleanText,
  joinSafe
} = educatorAgent;
const { buildExperimentalOutcomePromptContext } = require("../../experimentalOutcome");

function buildFutureSelfIntroSafetyCaseContext(
  safetyCase = {}
) {
  const scenario =
    safetyCase.scenario ||
    {};

  const actualCase =
    safetyCase.actual_case ||
    {};

  const sourceNotice =
    "이 자료는 INDEX에서 참가자가 선택한 실제 사고사례의 동일 행입니다.";

  return `
==============================
[INDEX에서 선택한 실제 사고사례 정보]
==============================

시나리오 ID:
${cleanText(scenario.scenario_id)}

대공정:
${cleanText(scenario.major_process)}

세부공정:
${cleanText(scenario.detail_process)}

작업내용:
${cleanText(scenario.process_content)}

위험유형:
${cleanText(scenario.risk_type)}

행동 저해요인:
${joinSafe(scenario.triggers)}


==============================
[동일 행의 실제 사고자료]
==============================

자료 구분:
${sourceNotice}

사례 ID:
${cleanText(actualCase.case_id)}

실제 사고 작업:
${cleanText(actualCase.process)}

사고유형:
${cleanText(actualCase.risk_type)}

분류된 주요 원인:
${cleanText(actualCase.trigger)}

사고 요약:
${cleanText(actualCase.summary)}

실제 사고 원문:
${cleanText(actualCase.raw_text)}

${buildExperimentalOutcomePromptContext(safetyCase)}
`.trim();
}

module.exports = {
  buildFutureSelfIntroSafetyCaseContext
};
