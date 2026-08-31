window.PreSurveyScenarios = (() => {
  function renderScenarios(scenarios) {
    const loadingElement = document.getElementById("scenarioLoading");
    const gridElement = document.getElementById("scenarioGrid");
    const detailProcess = window.PreSurveyForm.getChecked("detailProcess")[0] || "";

    loadingElement.hidden = true;
    gridElement.hidden = false;
    gridElement.innerHTML = scenarios.map((scenario, index) => `
      <div class="scenario-card" data-idx="${index}">
        <div class="scenario-tags">
          ${detailProcess ? `<span class="tag-process">${detailProcess}</span>` : ""}
          ${scenario.processContent ? `<span class="tag-content">${scenario.processContent}</span>` : ""}
          <span class="scenario-tag">${scenario.primaryAccident || "위험"}</span>
        </div>
        <div class="scenario-text">${scenario.scenario}</div>
      </div>
    `).join("");

    gridElement.querySelectorAll(".scenario-card").forEach((card) => {
      card.addEventListener("click", () => {
        window.PreSurveyState.setSelectedScenario(scenarios[Number(card.dataset.idx)]);
        gridElement.querySelectorAll(".scenario-card").forEach((item) => item.classList.remove("selected"));
        card.classList.add("selected");
        document.getElementById("postScenario").classList.add("visible");
      });
    });
  }

  async function loadScenarios() {
    const form = window.PreSurveyForm;
    const major = form.getChecked("majorProcess")[0] || "";
    const detail = form.getChecked("detailProcess")[0] || "";
    const loadingElement = document.getElementById("scenarioLoading");
    const gridElement = document.getElementById("scenarioGrid");
    const cacheKey = `${major}|${detail}`;
    const cachedScenarios = window.PreSurveyState.getCachedScenarios(cacheKey);

    if (cachedScenarios) {
      renderScenarios(cachedScenarios);
      return;
    }

    loadingElement.hidden = false;
    loadingElement.textContent = "⏳ 공정에 맞는 시나리오를 불러오는 중...";
    gridElement.hidden = true;
    gridElement.innerHTML = "";
    window.PreSurveyState.clearSelectedScenario();
    document.getElementById("postScenario").classList.remove("visible");

    if (!major || !detail) {
      loadingElement.textContent = "⚠️ 이전 단계에서 대공정과 세부공정을 선택해주세요.";
      return;
    }

    try {
      const params = new URLSearchParams({ major, detail });
      const response = await fetch(`/api/scenarios?${params}`);
      const data = await response.json();
      if (!data.ok || !data.scenarios || data.scenarios.length === 0) {
        loadingElement.textContent = "⚠️ 해당 공정의 시나리오를 찾을 수 없습니다.";
        return;
      }

      window.PreSurveyState.cacheScenarios(cacheKey, data.scenarios);
      renderScenarios(data.scenarios);
    } catch (error) {
      // 네트워크 boundary 실패는 재시도 대신 현재 단계에서 안내한다.
      loadingElement.textContent = "❌ 시나리오 로딩 실패. 새로고침 후 다시 시도해주세요.";
    }
  }

  return { loadScenarios };
})();
