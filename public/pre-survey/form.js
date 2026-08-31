window.PreSurveyForm = (() => {
  function getChecked(groupName) {
    const boxes = document.querySelectorAll(`[data-group="${groupName}"] input:checked`);
    return Array.from(boxes).map((box) => box.value);
  }

  function validateStep(step, selectedScenario) {
    if (step === 1) {
      if (!document.getElementById("name").value.trim()) return "이름을 입력해주세요.";
      if (!document.getElementById("org").value.trim()) return "소속을 입력해주세요.";
      if (getChecked("jobType").length === 0) return "직종을 선택해주세요.";
      if (!document.getElementById("position").value.trim()) return "직급을 입력해주세요.";
      if (!document.getElementById("career").value) return "경력을 선택해주세요.";
      if (!document.getElementById("ageGroup").value) return "연령대를 선택해주세요.";
    }

    if (step === 2) {
      const untouchedSlider = Array.from(document.querySelectorAll(".risk-slider"))
        .find((slider) => slider.dataset.touched !== "true");
      if (untouchedSlider) return "사고 위험지각 세 문항의 응답 바를 모두 한 번씩 움직여주세요.";
    }

    if (step === 3) {
      if (getChecked("majorProcess").length === 0) return "대공정을 선택해주세요.";
      if (getChecked("detailProcess").length === 0) return "세부공정을 선택해주세요.";
    }

    if (step === 4) {
      if (!selectedScenario) return "위험 시나리오를 선택해주세요.";
      if (getChecked("feeling").length === 0) return "강행 이유를 선택해주세요.";
    }

    return "";
  }

  function collectPayload(selectedScenario) {
    const majorProcess = getChecked("majorProcess");
    const detailProcess = getChecked("detailProcess");
    const feeling = getChecked("feeling");

    return {
      profile: {
        name: document.getElementById("name").value,
        org: document.getElementById("org").value,
        jobType: getChecked("jobType"),
        position: document.getElementById("position").value,
        career: document.getElementById("career").value,
        ageGroup: document.getElementById("ageGroup").value,
        importantPerson: document.getElementById("importantPersonType").value,
      },
      incident: {
        majorProcess: majorProcess[0] || "",
        detailProcess: detailProcess[0] || "",
        triggers: getChecked("triggers"),
        scenarioRowId: selectedScenario?.id ?? null,
        sentence: selectedScenario?.scenario || "",
        riskType: selectedScenario?.primaryAccident || "",
        accidents: selectedScenario?.accidents || [],
        processContent: selectedScenario?.processContent || "",
        feeling: feeling[0] || "",
      },
      psychology: {
        lowReason: getChecked("lowReason"),
        extraComment: document.getElementById("extraComment").value,
        riskPerception: {
          R1: Number(document.getElementById("preRiskR1").value),
          R2: Number(document.getElementById("preRiskR2").value),
          R3: Number(document.getElementById("preRiskR3").value),
        },
      },
    };
  }

  function bindChipLimits() {
    document.querySelectorAll(".chips").forEach((group) => {
      const maximum = Number(group.dataset.max) || 99;
      group.addEventListener("change", (event) => {
        if (group.querySelectorAll("input:checked").length <= maximum) return;
        event.target.checked = false;
        alert(`최대 ${maximum}개까지만 선택 가능합니다.`);
      });
    });
  }

  function bindProcessOptions() {
    const majorChips = document.getElementById("majorProcessChips");
    if (!majorChips) return;

    majorChips.addEventListener("change", (event) => {
      if (!event.target.matches("input")) return;

      const wrap = document.getElementById("detailProcessWrap");
      const detailContainer = document.getElementById("detailProcessChips");
      const checkedInput = document.querySelector('.chips[data-group="majorProcess"] input:checked');
      if (!checkedInput) {
        wrap.classList.add("hidden");
        detailContainer.innerHTML = "";
        return;
      }

      const details = window.PreSurveyState.PROCESS_MAP[checkedInput.value] || [];
      detailContainer.innerHTML = details.map((detail) => `
        <label class="chip">
          <input type="checkbox" value="${detail}" />${detail}
        </label>
      `).join("");
      wrap.classList.remove("hidden");
      window.PreSurveyState.clearScenarioCache();
    });

    document.addEventListener("change", (event) => {
      if (!event.target.closest?.('.chips[data-group="detailProcess"]')) return;
      window.PreSurveyState.clearScenarioCache();
    });
  }

  function bindRiskSliders() {
    document.querySelectorAll(".risk-slider").forEach((slider) => {
      const output = document.getElementById(`${slider.id}Value`);
      const update = () => {
        slider.dataset.touched = "true";
        if (output) output.value = slider.value;
      };
      slider.addEventListener("input", update);
      slider.addEventListener("change", update);
    });
  }

  return { bindChipLimits, bindProcessOptions, bindRiskSliders, collectPayload, getChecked, validateStep };
})();
