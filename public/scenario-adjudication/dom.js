(function (global) {
  "use strict";

  function select(selector) {
    return document.querySelector(selector);
  }

  function collectElements() {
    return {
      bundleFile: select("#bundleFile"),
      adjudicationFile: select("#adjudicationFile"),
      exportButton: select("#exportButton"),
      emptyState: select("#emptyState"),
      reviewArea: select("#reviewArea"),
      progressText: select("#progressText"),
      progressBar: select("#progressBar"),
      caseButtons: select("#caseButtons"),
      caseTag: select("#caseTag"),
      caseId: select("#caseId"),
      caseFacts: select("#caseFacts"),
      reviewerComparison: select("#reviewerComparison"),
      finalDetail: select("#finalDetail"),
      finalRisk: select("#finalRisk"),
      finalNoSuitable: select("#finalNoSuitable"),
      candidateCards: select("#candidateCards"),
      adjudicationNote: select("#adjudicationNote"),
      prevCase: select("#prevCase"),
      nextCase: select("#nextCase")
    };
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function fact(label, value) {
    const shown = Array.isArray(value) ? value.join(", ") : value;
    return `<div class="fact"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(shown || "-")}</dd></div>`;
  }

  function fillSelect(selectElement, values, selected, placeholder) {
    selectElement.innerHTML = [
      `<option value="">${escapeHtml(placeholder)}</option>`,
      ...values.map(value => `<option value="${escapeHtml(value)}" ${value === selected ? "selected" : ""}>${escapeHtml(value)}</option>`)
    ].join("");
  }

  global.ScenarioAdjudication = global.ScenarioAdjudication || {};
  global.ScenarioAdjudication.dom = {
    collectElements,
    escapeHtml,
    fact,
    fillSelect
  };
}(window));
