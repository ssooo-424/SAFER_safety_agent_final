(function (global) {
  "use strict";

  const app = global.ScenarioAdjudication;
  const state = app.state.createState();
  const elements = app.dom.collectElements();
  const renderer = app.rendering.createRenderer(state, elements);

  app.fileLoading.attachFileLoading(state, elements, renderer.render);
  app.navigationExport.attachNavigationAndExport(state, elements, renderer.render);
  app.fileLoading.loadDefaultBundle(state, renderer.render);
}(window));
