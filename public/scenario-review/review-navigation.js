(function (root) {
  "use strict";

  const review = root.ScenarioReview = root.ScenarioReview || {};

  function downloadReview(app) {
    const { elements, state } = app;
    if (!state.review) {
      alert("먼저 검토 번들을 불러오세요.");
      return;
    }
    const reviewerId = elements.reviewerId.value.trim();
    if (!reviewerId) {
      alert("평가자 ID를 입력하세요.");
      elements.reviewerId.focus();
      return;
    }
    const completeCount = state.review.cases.filter(review.store.isComplete).length;
    const isAllComplete = completeCount === state.review.cases.length;
    state.review.reviewer_id = reviewerId;
    state.review.reviewer_expertise = elements.reviewerExpertise.value.trim();
    state.review.review_status = isAllComplete ? "complete" : "draft";
    state.review.completed_at = isAllComplete ? new Date().toISOString() : null;
    state.activeReviewerId = reviewerId;
    review.store.saveLocal(app);
    const blob = new Blob(
      [JSON.stringify(state.review, null, 2)],
      { type: "application/json" }
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `scenario_review_${reviewerId}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    if (!isAllComplete) {
      alert(`현재 ${completeCount}/${state.review.cases.length}건 완료 상태로 draft 파일을 저장했습니다.`);
    }
  }

  function bindNavigation(app) {
    const { elements, state } = app;
    elements.reviewerId.addEventListener("change", () => {
      review.store.switchReviewer(app, elements.reviewerId.value.trim());
    });
    elements.reviewerExpertise.addEventListener("input", () => {
      if (!state.review) return;
      state.review.reviewer_expertise = elements.reviewerExpertise.value.trim();
      review.store.saveLocal(app);
    });
    elements.exportButton.addEventListener("click", () => downloadReview(app));
    elements.prevCase.addEventListener("click", () => {
      state.currentIndex = Math.max(0, state.currentIndex - 1);
      app.render();
    });
    elements.nextCase.addEventListener("click", () => {
      state.currentIndex = Math.min(
        state.bundle.cases.length - 1,
        state.currentIndex + 1
      );
      app.render();
    });
  }

  review.navigation = { bindNavigation };
}(window));
