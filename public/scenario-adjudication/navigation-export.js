(function (global) {
  "use strict";

  const { state: adjudicationState } = global.ScenarioAdjudication;

  function exportAdjudication(state) {
    if (!state.adjudication) {
      alert("합의 템플릿을 먼저 불러오세요.");
      return;
    }

    const complete = adjudicationState.updateStatus(state);
    adjudicationState.saveLocal(state);
    const blob = new Blob([JSON.stringify(state.adjudication, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "scenario_gold_adjudicated.json";
    anchor.click();
    URL.revokeObjectURL(url);

    if (state.adjudication.status !== "confirmed") {
      alert(`${complete}/${state.adjudication.cases.length}건 완료 상태로 draft를 저장했습니다.`);
    }
  }

  function attachNavigationAndExport(state, elements, render) {
    elements.exportButton.addEventListener("click", () => exportAdjudication(state));
    elements.prevCase.addEventListener("click", () => {
      state.currentIndex = Math.max(0, state.currentIndex - 1);
      render();
    });
    elements.nextCase.addEventListener("click", () => {
      state.currentIndex = Math.min(state.adjudication.cases.length - 1, state.currentIndex + 1);
      render();
    });
  }

  global.ScenarioAdjudication = global.ScenarioAdjudication || {};
  global.ScenarioAdjudication.navigationExport = {
    attachNavigationAndExport,
    exportAdjudication
  };
}(window));
