const postSurveyApiClient = window.SaferApi.createApiClient();
const POST_SURVEY_REQUEST_ID_KEY = "safer-post-survey-request-id";

const RADIO_QUESTIONS = [
  { id: "P1_1", label: "P1-1 (콘텐츠 몰입)" },
  { id: "P1_2", label: "P1-2 (과정 흥미)" },
  { id: "P1_3", label: "P1-3 (완전 몰입)" },
  { id: "P2_1", label: "P2-1 (작업 상황 연결)" },
  { id: "P2_2", label: "P2-2 (사고 상상)" },
  { id: "P2_3", label: "P2-3 (나 개인 관련)" },
  { id: "P2_4", label: "P2-4 (과거 경험 회상)" },
  { id: "C1", label: "C1 (안전수칙 효과 신뢰)" },
  { id: "I1", label: "I1 (작업 멈출 의향)" },
  { id: "D1_fear_a", label: "감정 반응 - 두려움 정도" },
  { id: "D1_tension_a", label: "감정 반응 - 긴장감 정도" },
  { id: "D1_discomfort_a", label: "감정 반응 - 불편감 정도" },
  { id: "D2", label: "D2 (감정 잔상)" },
];

const SCALE_QUESTIONS = [
  ["q-p1-1", "P1_1", "P1-1 : 방금 경험한 콘텐츠에 정신적으로 몰입했다고 느꼈다.", 5],
  ["q-p1-2", "P1_2", "P1-2 : 이 콘텐츠를 경험하는 과정이 흥미로웠다.", 5],
  ["q-p1-3", "P1_3", "P1-3 : 이 경험은 나를 완전히 몰입시키며 집중하게 했다.", 5],
  ["q-p2-1", "P2_1", "P2-1 : 이 콘텐츠가 실제 나의 작업 상황이나 현장에 대해 생각하게 만들었다.", 5],
  ["q-p2-2", "P2_2", "P2-2 : 콘텐츠 속 사고가 나에게 실제로 일어난다면 어떨지 구체적으로 상상해 보았다.", 5],
  ["q-p2-3", "P2_3", "P2-3 : 이 콘텐츠의 내용이 '나 개인'과 밀접한 관련이 있다고 느꼈다.", 5],
  ["q-p2-4", "P2_4", "P2-4 : 콘텐츠를 보는 동안 본인의 과거 경험이나 비슷한 현장 사례가 떠올랐다.", 5],
  ["q-c1", "C1", "C1 : 이번 콘텐츠에서 제안한 안전수칙을 지키는 것이 사고를 예방하는 데 실질적인 효과가 있을 것이라 믿습니까?", 5],
  ["q-i1", "I1", "I1 : 앞으로 비슷한 상황이 생기면, 서두르기보다 위험요인을 먼저 확인하거나 작업을 잠시 멈출 의향이 있습니까?", 5],
  ["q-D1-fear-a", "D1_fear_a", "D1-a. 두려움을 얼마나 느꼈나요?", 7],
  ["q-D1-tension-a", "D1_tension_a", "D1-a. 긴장감을 얼마나 느꼈나요?", 7],
  ["q-D1-discomfort-a", "D1_discomfort_a", "D1-a. 불편감을 얼마나 느꼈나요?", 7],
  ["q-D2", "D2", "이 경험에서 느낀 감정이 콘텐츠가 끝난 후에도 여전히 마음속에 남아있다.", 7],
];

// 재시도 때 같은 request ID를 보내 중복 저장을 막는다.
function getPostSurveyRequestId() {
  const existing = sessionStorage.getItem(POST_SURVEY_REQUEST_ID_KEY);
  if (existing) return existing;

  const requestId = crypto.randomUUID();
  sessionStorage.setItem(POST_SURVEY_REQUEST_ID_KEY, requestId);
  return requestId;
}

function moveBubble(input) {
  const bubble = input.parentElement.querySelector(".slider-bubble");
  const value = input.value;
  const percentage = (value - input.min) / (input.max - input.min);
  const thumbHalf = 11;
  const left = thumbHalf + percentage * (input.offsetWidth - 2 * thumbHalf);
  bubble.style.setProperty("--slider-bubble-left", `${left}px`);
  bubble.textContent = value;
}

function createScaleHtml(id, text, max) {
  let html = `<div class="question-text">${text}</div><div class="scale-wrapper" data-scale-points="${max}">`;
  for (let value = 1; value <= max; value += 1) {
    const label = value === 1 ? "전혀 아니다" : value === max ? "매우 그렇다" : "";
    html += `
      <label class="scale-item">
        <span class="scale-label">${label}</span>
        <input type="radio" name="${id}" value="${value}">
        <div class="scale-num">${value}</div>
      </label>`;
  }
  return `${html}</div>`;
}

function renderScaleQuestions() {
  for (const [containerId, id, text, max] of SCALE_QUESTIONS) {
    document.getElementById(containerId).innerHTML = createScaleHtml(id, text, max);
  }
}

function clearUnansweredState() {
  document.querySelectorAll(".scale-wrapper.unanswered, .question-card.unanswered").forEach((element) => {
    element.classList.remove("unanswered");
  });
}

// 누락 문항을 한 번에 안내해 반복 submit을 줄인다.
function collectRadioAnswers() {
  const answers = {};
  const missing = [];
  clearUnansweredState();

  for (const question of RADIO_QUESTIONS) {
    const selected = document.querySelector(`input[name="${question.id}"]:checked`);
    if (selected) {
      answers[question.id] = parseInt(selected.value);
      continue;
    }

    missing.push(question);
    const input = document.querySelector(`input[name="${question.id}"]`);
    input?.closest(".scale-wrapper")?.classList.add("unanswered");
    input?.closest(".question-card")?.classList.add("unanswered");
  }

  return { answers, missing };
}

function showMissingAnswers(missing) {
  const warnBanner = document.getElementById("warnBanner");
  warnBanner.hidden = false;
  warnBanner.textContent = `아직 ${missing.length}개 문항이 응답되지 않았어요. 빨간색으로 표시된 곳을 확인해주세요.`;
  const firstInput = document.querySelector(`input[name="${missing[0].id}"]`);
  const target = firstInput?.closest(".question-card") || firstInput?.closest(".scale-wrapper");
  target?.scrollIntoView({ behavior: "smooth", block: "center" });
}

function addOpenAnswers(answers) {
  for (const id of ["R1", "R2", "R3", "D1_fear_b", "D1_tension_b", "D1_discomfort_b"]) {
    answers[id] = parseInt(document.getElementById(id).value);
  }
  for (let index = 1; index <= 6; index += 1) {
    answers[`interview_${index}`] = document.getElementById(`int_${index}`).value;
  }
}

async function savePostSurvey() {
  const button = document.getElementById("save-btn");
  const { answers, missing } = collectRadioAnswers();
  if (missing.length > 0) {
    showMissingAnswers(missing);
    return;
  }

  document.getElementById("warnBanner").hidden = true;
  addOpenAnswers(answers);
  const payload = {
    surveyType: "POST_SURVEY",
    data: answers,
    commitSelectedRule: localStorage.getItem("commitSelectedRule") || "",
    commitFinalPhrase: localStorage.getItem("commitFinalPhrase") || "",
    timestamp: new Date().toISOString(),
  };

  button.disabled = true;
  button.textContent = "저장 중...";
  try {
    const result = await postSurveyApiClient.postJson(
      "/api/submit-post-survey",
      payload,
      getPostSurveyRequestId(),
    );
    sessionStorage.removeItem(POST_SURVEY_REQUEST_ID_KEY);
    localStorage.removeItem("preSurveyResult");
    localStorage.removeItem("saferAssignedCondition");
    localStorage.removeItem("commitSelectedRule");
    localStorage.removeItem("commitFinalPhrase");
    alert(`설문 완료! 파일이 저장되었습니다: ${result.filename}`);
    window.location.href = "/";
  } catch (error) {
    alert(`저장 실패: ${error.message}`);
    button.disabled = false;
    button.textContent = "설문 제출 및 종료";
  }
}

renderScaleQuestions();
document.querySelectorAll('.slider-container input[type="range"]').forEach((input) => {
  input.addEventListener("input", () => moveBubble(input));
  moveBubble(input);
});
document.addEventListener("change", (event) => {
  if (!event.target.matches('input[type="radio"]')) return;
  event.target.closest(".scale-wrapper")?.classList.remove("unanswered");
  event.target.closest(".question-card")?.classList.remove("unanswered");
});
window.addEventListener("resize", () => {
  document.querySelectorAll('.slider-container input[type="range"]').forEach(moveBubble);
});
document.getElementById("save-btn").addEventListener("click", savePostSurvey);
