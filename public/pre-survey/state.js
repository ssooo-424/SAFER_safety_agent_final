window.PreSurveyState = (() => {
  const PROCESS_MAP = {
    "가설공사": ["가설공사"],
    "토공사": ["토공사"],
    "골조공사": ["거푸집 작업", "철근·철골 작업", "콘크리트"],
    "마감공사": ["마감공사", "미장/견출 작업", "도장 작업", "방수 작업", "조적 작업"],
    "설비공사": ["설비공사"],
    "전기·통신공사": ["전기·통신공사"],
    "양중·운반": ["양중·운반"],
    "운반/자재반입": ["운반/자재반입"],
    "토목·기타": ["토목·기타"],
    "공통": ["공통"],
  };

  let currentStep = 1;
  let selectedScenario = null;
  let cachedScenarioKey = null;
  let cachedScenarios = null;

  function clearScenarioCache() {
    cachedScenarioKey = null;
    cachedScenarios = null;
  }

  return {
    PROCESS_MAP,
    totalSteps: 5,
    getCurrentStep: () => currentStep,
    setCurrentStep: (step) => {
      currentStep = step;
    },
    getSelectedScenario: () => selectedScenario,
    setSelectedScenario: (scenario) => {
      selectedScenario = scenario;
    },
    clearSelectedScenario: () => {
      selectedScenario = null;
    },
    getCachedScenarios: (key) => cachedScenarioKey === key ? cachedScenarios : null,
    cacheScenarios: (key, scenarios) => {
      cachedScenarioKey = key;
      cachedScenarios = scenarios;
    },
    clearScenarioCache,
  };
})();
