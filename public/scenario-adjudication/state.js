(function (global) {
  "use strict";

  const storageKey = "safer-scenario-adjudication-v1";

  function createState() {
    return {
      bundle: null,
      adjudication: null,
      currentIndex: 0
    };
  }

  function bundleCase(state, caseId) {
    return state.bundle.cases.find(item => item.case_id === caseId);
  }

  function currentCase(state) {
    return state.adjudication.cases[state.currentIndex];
  }

  function ratingMap(item) {
    return new Map((item.scenario_relevance || []).map(rating => [
      String(rating.scenario_id),
      rating
    ]));
  }

  function isComplete(item) {
    if (item.scenario_match_evaluable === false) return true;

    const ratingsComplete = (item.scenario_relevance || []).every(rating =>
      Number.isInteger(rating.final_relevance_score)
    );
    const candidateDecisionComplete = item.final_no_suitable_candidate === true ||
      item.final_best_scenario_id !== null;

    return Boolean(
      item.final_expected_detail_process &&
      item.final_expected_primary_risk &&
      typeof item.final_no_suitable_candidate === "boolean" &&
      candidateDecisionComplete &&
      ratingsComplete
    );
  }

  function saveLocal(state) {
    if (!state.adjudication) return;

    // 재시작 뒤에도 같은 판정을 복원하려고 고정 localStorage key를 사용한다.
    localStorage.setItem(storageKey, JSON.stringify(state.adjudication));
  }

  function updateStatus(state) {
    const complete = state.adjudication.cases.filter(isComplete).length;
    state.adjudication.status = complete === state.adjudication.cases.length
      ? "confirmed"
      : "draft";
    return complete;
  }

  global.ScenarioAdjudication = global.ScenarioAdjudication || {};
  global.ScenarioAdjudication.state = {
    storageKey,
    createState,
    bundleCase,
    currentCase,
    ratingMap,
    isComplete,
    saveLocal,
    updateStatus
  };
}(window));
