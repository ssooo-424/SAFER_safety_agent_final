(function (global) {
  "use strict";

  const { dom, state: adjudicationState } = global.ScenarioAdjudication;

  function renderCandidate(candidate, item, finalRating) {
    const accepted = (item.final_acceptable_scenario_ids || [])
      .map(String)
      .includes(String(candidate.scenario_id));
    const best = String(item.final_best_scenario_id) === String(candidate.scenario_id);

    return `
      <article class="candidate-card ${best ? "best" : ""}" data-scenario-id="${dom.escapeHtml(candidate.scenario_id)}">
        <h3>후보 시나리오</h3>
        <div class="candidate-meta">
          <span class="chip">${dom.escapeHtml(candidate.detail_process)}</span>
          <span class="chip">${dom.escapeHtml(candidate.process_content)}</span>
          <span class="chip">${dom.escapeHtml(candidate.primary_risk_type)}</span>
        </div>
        <p class="scenario-text">${dom.escapeHtml(candidate.scenario)}</p>
        <p class="hazard-text"><strong>평가자 점수:</strong> A ${dom.escapeHtml(finalRating.reviewer_a_score ?? "-")} / B ${dom.escapeHtml(finalRating.reviewer_b_score ?? "-")}</p>
        <div class="candidate-controls">
          <label>최종 적합도
            <select data-field="score">
              <option value="">점수 선택</option>
              ${[1, 2, 3, 4, 5].map(score => `<option value="${score}" ${finalRating.final_relevance_score === score ? "selected" : ""}>${score}점</option>`).join("")}
            </select>
          </label>
          <label class="check-control"><input data-field="acceptable" type="checkbox" ${accepted ? "checked" : ""}> 수용 가능</label>
          <label class="check-control"><input data-field="best" type="radio" name="finalBest" ${best ? "checked" : ""}> 가장 적합</label>
        </div>
      </article>`;
  }

  function createRenderer(state, elements) {
    function renderProgress() {
      if (!state.adjudication) {
        elements.progressText.textContent = "0 / 0";
        elements.progressBar.style.setProperty("--progress-width", "0%");
        return;
      }

      const complete = state.adjudication.cases.filter(adjudicationState.isComplete).length;
      const total = state.adjudication.cases.length;
      elements.progressText.textContent = `${complete} / ${total}`;
      elements.progressBar.style.setProperty(
        "--progress-width",
        `${total ? complete / total * 100 : 0}%`
      );
    }

    function renderButtons() {
      elements.caseButtons.innerHTML = state.adjudication.cases.map((item, index) => {
        const classes = ["case-button"];
        if (index === state.currentIndex) classes.push("active");
        if (adjudicationState.isComplete(item)) classes.push("complete");
        return `<button type="button" class="${classes.join(" ")}" data-index="${index}">${dom.escapeHtml(item.case_id.replace("CASE_", ""))}</button>`;
      }).join("");

      elements.caseButtons.querySelectorAll("button").forEach(button => {
        button.addEventListener("click", () => {
          state.currentIndex = Number(button.dataset.index);
          render();
        });
      });
    }

    function bindCaseControls(item) {
      elements.finalDetail.onchange = event => {
        item.final_expected_detail_process = event.target.value || null;
        adjudicationState.saveLocal(state);
        renderProgress();
        renderButtons();
      };
      elements.finalRisk.onchange = event => {
        item.final_expected_primary_risk = event.target.value || null;
        adjudicationState.saveLocal(state);
        renderProgress();
        renderButtons();
      };
      elements.finalNoSuitable.onchange = event => {
        item.final_no_suitable_candidate = event.target.checked;
        if (event.target.checked) {
          item.final_best_scenario_id = null;
          item.final_acceptable_scenario_ids = [];
        }
        adjudicationState.saveLocal(state);
        render();
      };
      elements.adjudicationNote.oninput = event => {
        item.adjudication_note = event.target.value;
        adjudicationState.saveLocal(state);
      };

      const ratings = adjudicationState.ratingMap(item);
      elements.candidateCards.querySelectorAll(".candidate-card").forEach(card => {
        const scenarioId = card.dataset.scenarioId;
        const rating = ratings.get(scenarioId);
        card.querySelector('[data-field="score"]').addEventListener("change", event => {
          rating.final_relevance_score = event.target.value ? Number(event.target.value) : null;
          adjudicationState.saveLocal(state);
          renderProgress();
          renderButtons();
        });
        card.querySelector('[data-field="acceptable"]').addEventListener("change", event => {
          const ids = new Set((item.final_acceptable_scenario_ids || []).map(String));
          event.target.checked ? ids.add(scenarioId) : ids.delete(scenarioId);
          item.final_acceptable_scenario_ids = [...ids].map(value =>
            Number.isNaN(Number(value)) ? value : Number(value)
          );
          item.final_no_suitable_candidate = false;
          adjudicationState.saveLocal(state);
          renderProgress();
        });
        card.querySelector('[data-field="best"]').addEventListener("change", event => {
          if (event.target.checked) {
            item.final_best_scenario_id = Number.isNaN(Number(scenarioId))
              ? scenarioId
              : Number(scenarioId);
            item.final_no_suitable_candidate = false;
          }
          adjudicationState.saveLocal(state);
          render();
        });
      });
    }

    function render() {
      const ready = state.bundle && state.adjudication;
      elements.emptyState.hidden = Boolean(ready);
      elements.reviewArea.hidden = !ready;
      if (!ready) {
        renderProgress();
        return;
      }

      const item = adjudicationState.currentCase(state);
      const source = adjudicationState.bundleCase(state, item.case_id);
      const input = source.input;
      elements.caseTag.textContent = source.test_tag || "ADJUDICATION";
      elements.caseId.textContent = item.case_id;
      elements.caseFacts.innerHTML = [
        dom.fact("대공정", input.major_process),
        dom.fact("검색 성능 평가", item.scenario_match_evaluable === false ? "제외 — 입력 정보 불충분" : "포함"),
        dom.fact("작업자 역할", [input.position, ...(input.job_types || [])].filter(Boolean)),
        dom.fact("저해요인", input.triggers),
        dom.fact("예상 결과", input.consequence),
        dom.fact("감정/판단", input.feeling),
        dom.fact("추가 설명", input.extra_comment)
      ].join("");
      elements.reviewerComparison.innerHTML = [
        dom.fact("평가자 A 세부공정 / 사고유형", [item.reviewer_a.expected_detail_process, item.reviewer_a.expected_primary_risk]),
        dom.fact("평가자 B 세부공정 / 사고유형", [item.reviewer_b.expected_detail_process, item.reviewer_b.expected_primary_risk]),
        dom.fact("평가자 A 최적 / 수용 후보", [item.reviewer_a.best_scenario_id, ...(item.reviewer_a.acceptable_scenario_ids || [])]),
        dom.fact("평가자 B 최적 / 수용 후보", [item.reviewer_b.best_scenario_id, ...(item.reviewer_b.acceptable_scenario_ids || [])])
      ].join("");
      dom.fillSelect(elements.finalDetail, source.allowed_detail_processes || [], item.final_expected_detail_process, "최종 세부공정 선택");
      dom.fillSelect(elements.finalRisk, source.allowed_risk_types || state.bundle.risk_types || [], item.final_expected_primary_risk, "최종 사고유형 선택");
      elements.finalNoSuitable.checked = item.final_no_suitable_candidate === true;
      elements.adjudicationNote.value = item.adjudication_note || "";

      const ratings = adjudicationState.ratingMap(item);
      elements.candidateCards.innerHTML = (source.review_candidates || []).map(candidate =>
        renderCandidate(candidate, item, ratings.get(String(candidate.scenario_id)) || {
          scenario_id: candidate.scenario_id,
          reviewer_a_score: null,
          reviewer_b_score: null,
          final_relevance_score: null
        })
      ).join("");
      elements.prevCase.disabled = state.currentIndex === 0;
      elements.nextCase.disabled = state.currentIndex === state.adjudication.cases.length - 1;
      bindCaseControls(item);
      renderButtons();
      renderProgress();
    }

    return { render };
  }

  global.ScenarioAdjudication = global.ScenarioAdjudication || {};
  global.ScenarioAdjudication.rendering = { createRenderer };
}(window));
