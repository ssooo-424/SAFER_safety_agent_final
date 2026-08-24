(function (root) {
  "use strict";

  const review = root.ScenarioReview = root.ScenarioReview || {};

  function hashNumber(text) {
    let hash = 2166136261;
    for (const character of String(text)) {
      hash ^= character.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function orderedCandidates(bundleCase, reviewerId) {
    return [...(bundleCase.review_candidates || [])].sort((left, right) =>
      hashNumber(`${reviewerId}:${bundleCase.case_id}:${left.scenario_id}`) -
      hashNumber(`${reviewerId}:${bundleCase.case_id}:${right.scenario_id}`)
    );
  }

  function blankReview(bundle) {
    return {
      schema_version: "2.0",
      protocol_version: "scenario-human-review-v1",
      reviewer_id: "",
      reviewer_expertise: "",
      review_status: "draft",
      completed_at: null,
      cases: bundle.cases.map(item => ({
        case_id: item.case_id,
        expected_detail_process: null,
        expected_primary_risk: null,
        no_suitable_candidate: false,
        best_scenario_id: null,
        acceptable_scenario_ids: [],
        candidate_ratings: (item.review_candidates || []).map(candidate => ({
          scenario_id: candidate.scenario_id,
          relevance_score: null,
          acceptable: false,
          note: ""
        })),
        reviewer_note: ""
      }))
    };
  }

  function reviewCase(state, caseId) {
    return state.review.cases.find(item => item.case_id === caseId);
  }

  function ensureReviewShape(app) {
    const { elements, state } = app;
    if (!state.bundle) return;
    const existing = state.review || blankReview(state.bundle);
    const existingMap = new Map(
      (existing.cases || []).map(item => [item.case_id, item])
    );
    const fresh = blankReview(state.bundle);
    fresh.reviewer_id = existing.reviewer_id || "";
    fresh.reviewer_expertise = existing.reviewer_expertise || "";
    fresh.review_status = existing.review_status || "draft";
    fresh.completed_at = existing.completed_at || null;
    fresh.cases = fresh.cases.map(item => {
      const old = existingMap.get(item.case_id);
      if (!old) return item;
      const oldRatings = new Map(
        (old.candidate_ratings || []).map(rating => [
          String(rating.scenario_id),
          rating
        ])
      );
      return {
        ...item,
        ...old,
        candidate_ratings: item.candidate_ratings.map(rating => ({
          ...rating,
          ...(oldRatings.get(String(rating.scenario_id)) || {})
        }))
      };
    });
    state.review = fresh;
    elements.reviewerId.value = fresh.reviewer_id;
    elements.reviewerExpertise.value = fresh.reviewer_expertise;
  }

  function storageKey(state, reviewerId = state.activeReviewerId) {
    return `safer-scenario-review-v1:${reviewerId}`;
  }

  function saveLocal(app) {
    const { elements, state } = app;
    if (!state.review) return;
    state.review.reviewer_id =
      state.activeReviewerId === "anonymous" ? "" : state.activeReviewerId;
    state.review.reviewer_expertise = elements.reviewerExpertise.value.trim();
    localStorage.setItem(storageKey(state), JSON.stringify(state.review));
  }

  function restoreLocal(app) {
    const { state } = app;
    if (!state.bundle) return;
    const saved = localStorage.getItem(storageKey(state));
    if (saved) {
      try {
        state.review = JSON.parse(saved);
      } catch (_) {
        // 손상된 localStorage JSON은 새 draft로 바꿔 review workflow를 계속합니다.
        state.review = blankReview(state.bundle);
      }
    } else {
      state.review = blankReview(state.bundle);
    }
    ensureReviewShape(app);
  }

  function switchReviewer(app, nextReviewerId) {
    const { state } = app;
    if (!state.bundle) return;
    saveLocal(app);
    state.activeReviewerId = nextReviewerId || "anonymous";
    const saved = localStorage.getItem(storageKey(state));
    state.review = saved ? JSON.parse(saved) : blankReview(state.bundle);
    state.review.reviewer_id =
      state.activeReviewerId === "anonymous" ? "" : state.activeReviewerId;
    ensureReviewShape(app);
    state.currentIndex = 0;
    app.render();
  }

  function isComplete(item) {
    if (item.scenario_match_evaluable === false) return true;
    const ratingsComplete = (item.candidate_ratings || []).every(rating =>
      Number.isInteger(rating.relevance_score) &&
      typeof rating.acceptable === "boolean"
    );
    return Boolean(
      item.expected_detail_process &&
      item.expected_primary_risk &&
      ratingsComplete &&
      (item.no_suitable_candidate || item.best_scenario_id !== null)
    );
  }

  review.store = {
    blankReview,
    ensureReviewShape,
    isComplete,
    orderedCandidates,
    restoreLocal,
    reviewCase,
    saveLocal,
    switchReviewer
  };
}(window));
