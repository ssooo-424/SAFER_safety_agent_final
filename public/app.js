const SUBMIT_REQUEST_ID_KEY = "safer-submit-request-id";

const stepError = document.getElementById("stepError");
const progressPill = document.getElementById("progressPill");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const apiClient = window.SaferApi.createApiClient();
const state = window.PreSurveyState;
const form = window.PreSurveyForm;

function getSubmissionRequestId() {
  const existing = sessionStorage.getItem(SUBMIT_REQUEST_ID_KEY);
  if (existing) return existing;

  const requestId = crypto.randomUUID();
  // 재전송에도 서버 idempotency key가 유지되도록 sessionStorage를 사용한다.
  sessionStorage.setItem(SUBMIT_REQUEST_ID_KEY, requestId);
  return requestId;
}

function showError(message) {
  if (stepError) {
    stepError.textContent = message;
    stepError.classList.toggle("is-visible", Boolean(message));
  } else if (message) {
    alert(message);
  }
}

function setStep(step) {
  state.setCurrentStep(step);
  document.querySelectorAll(".step").forEach((element) => {
    element.classList.toggle("active", Number(element.dataset.step) === step);
  });

  if (progressPill) progressPill.textContent = `Step ${step} / ${state.totalSteps}`;
  if (prevBtn) prevBtn.disabled = step === 1;
  if (nextBtn) nextBtn.textContent = step === state.totalSteps ? "제출하기" : "다음";

  showError("");
  window.scrollTo(0, 0);
  if (step === 4) window.PreSurveyScenarios.loadScenarios();
}

document.addEventListener("DOMContentLoaded", () => {
  setStep(1);
  form.bindChipLimits();
  form.bindProcessOptions();
  form.bindRiskSliders();

  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      if (state.getCurrentStep() > 1) setStep(state.getCurrentStep() - 1);
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", async () => {
      const validationError = form.validateStep(
        state.getCurrentStep(),
        state.getSelectedScenario(),
      );
      if (validationError) return showError(validationError);

      if (state.getCurrentStep() === state.totalSteps) {
        await submitSurvey();
      } else {
        setStep(state.getCurrentStep() + 1);
      }
    });
  }

  async function submitSurvey() {
    nextBtn.disabled = true;
    nextBtn.textContent = "저장 중...";

    try {
      const json = await window.PreSurveySubmission.submit(
        apiClient,
        form.collectPayload(state.getSelectedScenario()),
        getSubmissionRequestId(),
      );
      if (json.ok) {
        sessionStorage.removeItem(SUBMIT_REQUEST_ID_KEY);
        sessionStorage.removeItem("safer-turn-timings");
        localStorage.removeItem("preSurveyResult");
        localStorage.removeItem("saferAssignedCondition");
        localStorage.removeItem("commitSelectedRule");
        localStorage.removeItem("commitFinalPhrase");
        localStorage.setItem("preSurveyResult", JSON.stringify(json));
        localStorage.removeItem("branchChoice");
        localStorage.removeItem("chosenCondition");
        localStorage.removeItem("selectedCondition");
        window.location.href = "/safer";
      } else {
        alert("저장 실패: " + (json.error || "알 수 없는 오류"));
        nextBtn.disabled = false;
      }
    } catch(e) {
      alert("제출 실패: " + e.message);
      nextBtn.disabled = false;
    }
  }
});
