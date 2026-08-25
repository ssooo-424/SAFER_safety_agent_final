(function exposeSaferTurnTiming() {
  const STORAGE_KEY = "safer-turn-timings";

  function createTurnTimingTracker({
    documentRef = document,
    storage = sessionStorage,
    monotonicNow = () => performance.now(),
    wallNow = () => Date.now()
  } = {}) {
    let records = readStoredTimings(storage);
    let current = null;

    function persist() {
      storage.setItem(STORAGE_KEY, JSON.stringify(records));
    }

    function pauseActive(now = monotonicNow()) {
      if (!current || current.activeStartedAt === null) return;
      current.activeMs += Math.max(0, now - current.activeStartedAt);
      current.activeStartedAt = null;
    }

    function start(stage) {
      if (!stage || current?.stage === stage) return;
      const mono = monotonicNow();
      current = {
        stage,
        activeMs: 0,
        hiddenMs: 0,
        activeStartedAt: documentRef.hidden ? null : mono,
        hiddenStartedAt: documentRef.hidden ? mono : null,
        startedWallMs: wallNow()
      };
    }

    function complete(completionAction) {
      if (!current) return null;
      const mono = monotonicNow();
      pauseActive(mono);
      if (current.hiddenStartedAt !== null) {
        current.hiddenMs += Math.max(0, mono - current.hiddenStartedAt);
      }
      const completedWallMs = wallNow();
      const record = {
        activeMs: Math.round(current.activeMs),
        totalMs: Math.round(Math.max(0, completedWallMs - current.startedWallMs)),
        hiddenMs: Math.round(current.hiddenMs),
        startedAt: new Date(current.startedWallMs).toISOString(),
        completedAt: new Date(completedWallMs).toISOString(),
        completionAction: String(completionAction || "").slice(0, 40)
      };
      records[current.stage] = record;
      current = null;
      persist();
      return record;
    }

    function handleVisibilityChange() {
      if (!current) return;
      const mono = monotonicNow();
      if (documentRef.hidden) {
        pauseActive(mono);
        current.hiddenStartedAt = mono;
        return;
      }
      if (current.hiddenStartedAt !== null) {
        current.hiddenMs += Math.max(0, mono - current.hiddenStartedAt);
        current.hiddenStartedAt = null;
      }
      current.activeStartedAt = mono;
    }

    documentRef.addEventListener("visibilitychange", handleVisibilityChange);

    return {
      complete,
      currentStage: () => current?.stage || "",
      snapshot: () => JSON.parse(JSON.stringify(records)),
      start
    };
  }

  function readStoredTimings(storage = sessionStorage) {
    try {
      const parsed = JSON.parse(storage.getItem(STORAGE_KEY) || "{}");
      return parsed && !Array.isArray(parsed) && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  window.SaferTurnTiming = { STORAGE_KEY, createTurnTimingTracker, readStoredTimings };
})();
