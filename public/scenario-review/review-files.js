(function (root) {
  "use strict";

  const review = root.ScenarioReview = root.ScenarioReview || {};

  function readJsonFile(file) {
    return file.text().then(text => JSON.parse(text));
  }

  async function loadDefaultBundle(app) {
    try {
      const response = await fetch("research/scenario_validation_bundle.json", {
        cache: "no-store"
      });
      if (!response.ok) throw new Error("bundle not found");
      app.state.bundle = await response.json();
      review.store.restoreLocal(app);
      app.render();
    } catch (_) {
      app.render();
    }
  }

  function bindFileInputs(app) {
    const { elements, state } = app;
    elements.bundleFile.addEventListener("change", async event => {
      const file = event.target.files[0];
      if (!file) return;
      state.bundle = await readJsonFile(file);
      review.store.restoreLocal(app);
      state.currentIndex = 0;
      app.render();
    });
    elements.reviewFile.addEventListener("change", async event => {
      const file = event.target.files[0];
      if (!file || !state.bundle) {
        alert("검토 번들을 먼저 불러오세요.");
        return;
      }
      state.review = await readJsonFile(file);
      state.activeReviewerId = state.review.reviewer_id || "anonymous";
      review.store.ensureReviewShape(app);
      review.store.saveLocal(app);
      app.render();
    });
  }

  review.files = { bindFileInputs, loadDefaultBundle };
}(window));
