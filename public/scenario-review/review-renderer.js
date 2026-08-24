(function (root) {
  "use strict";

  const review = root.ScenarioReview = root.ScenarioReview || {};

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function fillSelect(select, values, selected, placeholder) {
    select.innerHTML = [
      `<option value="">${escapeHtml(placeholder)}</option>`,
      ...values.map(value =>
        `<option value="${escapeHtml(value)}" ${value === selected ? "selected" : ""}>${escapeHtml(value)}</option>`
      )
    ].join("");
  }

  function fact(label, value) {
    const display = Array.isArray(value) ? value.join(", ") : value;
    return `<div class="fact"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(display || "-")}</dd></div>`;
  }

  function renderCandidate(candidate, currentReview) {
    const rating = currentReview.candidate_ratings.find(item =>
      String(item.scenario_id) === String(candidate.scenario_id)
    );
    const isBest = String(currentReview.best_scenario_id) ===
      String(candidate.scenario_id);
    return `
      <article class="candidate-card ${isBest ? "best" : ""}" data-scenario-id="${escapeHtml(candidate.scenario_id)}">
        <h3>후보 시나리오</h3>
        <div class="candidate-meta">
          <span class="chip">${escapeHtml(candidate.detail_process)}</span>
          <span class="chip">${escapeHtml(candidate.process_content)}</span>
          <span class="chip">${escapeHtml(candidate.primary_risk_type)}</span>
        </div>
        <p class="scenario-text">${escapeHtml(candidate.scenario)}</p>
        <p class="hazard-text"><strong>위험요인:</strong> ${escapeHtml(candidate.hazard || "-")}</p>
        <div class="candidate-controls">
          <label>적합도
            <select data-field="score">
              <option value="">점수 선택</option>
              ${[1, 2, 3, 4, 5].map(score => `<option value="${score}" ${rating && rating.relevance_score === score ? "selected" : ""}>${score}점</option>`).join("")}
            </select>
          </label>
          <label class="check-control"><input data-field="acceptable" type="checkbox" ${rating && rating.acceptable ? "checked" : ""}> 수용 가능</label>
          <label class="check-control"><input data-field="best" type="radio" name="bestScenario" ${isBest ? "checked" : ""}> 가장 적합</label>
          <label>후보 메모
            <input data-field="note" type="text" value="${escapeHtml(rating ? rating.note : "")}" placeholder="선택/제외 이유">
          </label>
        </div>
      </article>`;
  }

  function renderProgress(app) {
    const { elements, state } = app;
    if (!state.review) {
      elements.progressText.textContent = "0 / 0";
      elements.progressBar.style.setProperty("--progress-width", "0%");
      return;
    }
    const complete = state.review.cases.filter(review.store.isComplete).length;
    const total = state.review.cases.length;
    elements.progressText.textContent = `${complete} / ${total}`;
    elements.progressBar.style.setProperty("--progress-width", total
      ? `${(complete / total) * 100}%`
      : "0%");
  }

  function renderCaseButtons(app) {
    const { elements, state } = app;
    elements.caseButtons.innerHTML = state.bundle.cases.map((item, index) => {
      const reviewed = review.store.reviewCase(state, item.case_id);
      const classes = ["case-button"];
      if (index === state.currentIndex) classes.push("active");
      if (reviewed && review.store.isComplete(reviewed)) classes.push("complete");
      return `<button class="${classes.join(" ")}" data-index="${index}" type="button">${escapeHtml(item.case_id.replace("CASE_", ""))}</button>`;
    }).join("");
    elements.caseButtons.querySelectorAll("button").forEach(button => {
      button.addEventListener("click", () => {
        state.currentIndex = Number(button.dataset.index);
        app.render();
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    });
  }

  function bindCaseInputs(app, currentReview) {
    const { elements } = app;
    elements.expectedDetail.onchange = event => {
      currentReview.expected_detail_process = event.target.value || null;
      review.store.saveLocal(app);
      renderProgress(app);
      renderCaseButtons(app);
    };
    elements.expectedRisk.onchange = event => {
      currentReview.expected_primary_risk = event.target.value || null;
      review.store.saveLocal(app);
      renderProgress(app);
      renderCaseButtons(app);
    };
    elements.noSuitable.onchange = event => {
      currentReview.no_suitable_candidate = event.target.checked;
      if (event.target.checked) currentReview.best_scenario_id = null;
      review.store.saveLocal(app);
      app.render();
    };
    elements.reviewerNote.oninput = event => {
      currentReview.reviewer_note = event.target.value;
      review.store.saveLocal(app);
    };
    elements.candidateCards.querySelectorAll(".candidate-card").forEach(card => {
      const scenarioId = card.dataset.scenarioId;
      const rating = currentReview.candidate_ratings.find(item =>
        String(item.scenario_id) === scenarioId
      );
      card.querySelector('[data-field="score"]').addEventListener("change", event => {
        rating.relevance_score = event.target.value ? Number(event.target.value) : null;
        review.store.saveLocal(app);
        renderProgress(app);
        renderCaseButtons(app);
      });
      card.querySelector('[data-field="acceptable"]').addEventListener("change", event => {
        rating.acceptable = event.target.checked;
        currentReview.acceptable_scenario_ids = currentReview.candidate_ratings
          .filter(item => item.acceptable)
          .map(item => item.scenario_id);
        review.store.saveLocal(app);
      });
      card.querySelector('[data-field="best"]').addEventListener("change", event => {
        if (event.target.checked) {
          currentReview.best_scenario_id = rating.scenario_id;
          currentReview.no_suitable_candidate = false;
        }
        review.store.saveLocal(app);
        app.render();
      });
      card.querySelector('[data-field="note"]').addEventListener("input", event => {
        rating.note = event.target.value;
        review.store.saveLocal(app);
      });
    });
  }

  function render(app) {
    const { elements, state } = app;
    if (!state.bundle || !state.review) {
      elements.emptyState.hidden = false;
      elements.reviewArea.hidden = true;
      renderProgress(app);
      return;
    }
    elements.emptyState.hidden = true;
    elements.reviewArea.hidden = false;
    const bundleCase = state.bundle.cases[state.currentIndex];
    const currentReview = review.store.reviewCase(state, bundleCase.case_id);
    elements.caseTag.textContent = bundleCase.test_tag || "TEST CASE";
    elements.caseId.textContent = bundleCase.case_id;
    const input = bundleCase.input;
    elements.caseFacts.innerHTML = [
      fact("대공정", input.major_process),
      fact(
        "검색 성능 평가",
        bundleCase.scenario_match_evaluable === false
          ? "제외 — 예상 결과 또는 세부공정 정보 불충분"
          : "포함"
      ),
      fact("작업자 역할", [input.position, ...(input.job_types || [])].filter(Boolean)),
      fact("저해요인", input.triggers),
      fact("예상 결과", input.consequence),
      fact("감정/판단", input.feeling),
      fact("추가 설명", input.extra_comment)
    ].join("");
    fillSelect(
      elements.expectedDetail,
      bundleCase.allowed_detail_processes || [],
      currentReview.expected_detail_process,
      "세부공정 선택"
    );
    fillSelect(
      elements.expectedRisk,
      bundleCase.allowed_risk_types || state.bundle.risk_types || [],
      currentReview.expected_primary_risk,
      "사고유형 선택"
    );
    elements.noSuitable.checked = currentReview.no_suitable_candidate;
    elements.reviewerNote.value = currentReview.reviewer_note || "";
    elements.candidateCards.innerHTML = review.store
      .orderedCandidates(bundleCase, elements.reviewerId.value.trim() || "anonymous")
      .map(candidate => renderCandidate(candidate, currentReview))
      .join("");
    elements.prevCase.disabled = state.currentIndex === 0;
    elements.nextCase.disabled = state.currentIndex === state.bundle.cases.length - 1;
    bindCaseInputs(app, currentReview);
    renderCaseButtons(app);
    renderProgress(app);
  }

  review.renderer = { render };
}(window));
