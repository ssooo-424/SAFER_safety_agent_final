const path = require("path");
const fs = require("fs");

let PERSONA_LIB = {};
try {
  const libPath = path.join(__dirname, "..", "safety_persona_lib.json");
  PERSONA_LIB = JSON.parse(fs.readFileSync(libPath, "utf8"));
  console.log(`✅ 페르소나 라이브러리 로드 완료 (v${PERSONA_LIB._meta?.version || "?"})`);
} catch (e) {
  console.warn("⚠️ safety_persona_lib.json 로드 실패:", e.message);
}

function joinSafe(val, sep = ", ", fallback = "") {
  if (Array.isArray(val)) return val.filter(Boolean).join(sep) || fallback;
  return val || fallback;
}

function getProcessText(incident) {
  const major = incident.majorProcess || "";
  const detail = incident.detailProcess || "";
  if (major && detail) {
    return major === detail ? major : `${major} > ${detail}`;
  }
  if (major) return major;
  if (detail) return detail;
  return joinSafe(incident.process, ", ", "현장 작업");
}

function getInjuryContext(riskType) {
  const mapping = {
    "추락": { part: "척추와 하반신", symptom: "하반신 마비로 인한 휠체어 생활" },
    "떨어짐": { part: "척추와 하반신", symptom: "하반신 마비로 인한 휠체어 생활" },
    "협착·끼임": { part: "손가락과 신경", symptom: "손가락 절단 및 신경 손상으로 인한 감각 소실" },
    "끼임": { part: "손가락과 신경", symptom: "손가락 절단 및 신경 손상으로 인한 감각 소실" },
    "깔림": { part: "갈비뼈와 장기", symptom: "복합 골절 및 장기 손상으로 만성 통증" },
    "낙하·비래": { part: "머리와 어깨", symptom: "뇌진탕 후유증과 만성 두통, 어지럼증" },
    "충돌·접촉": { part: "무릎과 골반", symptom: "복합 골절로 인한 보행 장애(절뚝거림)" },
    "충돌 및 접촉": { part: "무릎과 골반", symptom: "복합 골절로 인한 보행 장애(절뚝거림)" },
    "넘어짐": { part: "무릎과 손목", symptom: "관절 손상으로 인한 작업 능력 저하" },
    "감전·화재": { part: "피부와 신경", symptom: "심각한 화상 흉터와 신경병성 통증" },
    "감전": { part: "심장과 신경", symptom: "심장 부정맥과 신경 손상으로 인한 감각 이상" },
    "화상": { part: "피부와 표피", symptom: "심각한 화상 흉터와 만성 통증" },
    "붕괴·전도": { part: "전신", symptom: "장기간 입원과 재활이 필요한 복합 부상" },
    "절상(절단,찔림,베임)": { part: "손과 팔", symptom: "신경·힘줄 손상으로 손가락 움직임 제한" },
    "절상": { part: "손과 팔", symptom: "신경·힘줄 손상으로 손가락 움직임 제한" },
    "질식": { part: "호흡기와 뇌", symptom: "저산소증 후유증으로 인지 기능 저하" },
    "질병": { part: "호흡기와 근골격계", symptom: "만성 직업병으로 일상생활 제약" },
    "default": { part: "허리와 다리", symptom: "만성 디스크와 거동 불편" }
  };
  return mapping[riskType] || mapping["default"];
}

function getTimeGreeting() {
  const hour = new Date().getHours() + 9;
  if (hour >= 6 && hour < 12) return "오늘 하루도 안전하게 시작해야 해.";
  if (hour >= 12 && hour < 18) return "오후 작업도 집중력 잃지 마.";
  return "오늘 하루 고생 많았어. 편안한 저녁 보내.";
}

function summarizeContext(payload, scenarioId) {
  const p = payload.profile || payload.userInfo || {};
  const i = payload.incident || {};
  const processText = getProcessText(i);

  return `
[사용자 프로필]
- 이름: ${p.name || ""}, 소속: ${p.org || "현장"}, 직급: ${p.position || "작업자"}
- 직종: ${joinSafe(p.jobType, ", ", "작업자")}
- 가족: ${p.importantPerson || ""} (${p.importantPersonDetail || "정보 없음"})
- 안전성향: ${p.profileCode || "미정"}

[사고 상황]
- 공정: ${processText}
- 작업내용: ${i.processContent || ""}
- 위험유형(사고분류): ${i.riskType || ""}
- 트리거: ${joinSafe(i.triggers, ", ")}
- 선택한 시나리오: "${i.sentence || ""}"
  (⚠️ 이 시나리오 속 '작업자'는 제3자가 아니라 사용자 본인이다. 언급 시 반드시 2인칭("네가", "너가")으로 변환할 것)
- 강행 이유: ${i.feeling || ""}
`.trim();
}

module.exports = {
  PERSONA_LIB,
  joinSafe,
  getProcessText,
  getInjuryContext,
  getTimeGreeting,
  summarizeContext
};
