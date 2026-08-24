(function (global) {
  "use strict";

  function loadJson(file) {
    return file.text().then(text => JSON.parse(text));
  }

  async function loadOptionalJson(path) {
    try {
      const response = await fetch(path, { cache: "no-store" });
      return response.ok ? response.json() : null;
    } catch (_) {
      return null;
    }
  }

  async function loadDefaultBundle(state, render) {
    const [bundle, adjudication] = await Promise.all([
      loadOptionalJson("research/scenario_validation_bundle.json"),
      loadOptionalJson("research/adjudication_template.json")
    ]);

    if (bundle) state.bundle = bundle;
    if (adjudication) state.adjudication = adjudication;
    state.currentIndex = 0;
    render();
  }

  function attachFileLoading(state, elements, render) {
    elements.bundleFile.addEventListener("change", async event => {
      if (event.target.files[0]) state.bundle = await loadJson(event.target.files[0]);
      render();
    });
    elements.adjudicationFile.addEventListener("change", async event => {
      if (event.target.files[0]) state.adjudication = await loadJson(event.target.files[0]);
      state.currentIndex = 0;
      render();
    });
  }

  global.ScenarioAdjudication = global.ScenarioAdjudication || {};
  global.ScenarioAdjudication.fileLoading = {
    loadOptionalJson,
    loadDefaultBundle,
    attachFileLoading
  };
}(window));
