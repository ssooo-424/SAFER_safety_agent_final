(function exposeVoiceClient(factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  if (typeof window !== "undefined") {
    window.SaferVoice = api;
  }
})(function createVoiceClientModule() {
  // 음성 인식·합성은 브라우저에서 처리하며, 이 모듈은 원본 오디오를 업로드하거나 저장하지 않는다.
  function requiredCallback(callback) {
    return typeof callback === "function" ? callback : () => {};
  }

  function createDictationController({
    RecognitionConstructor,
    language = "ko-KR",
    onText,
    onStateChange,
    onError,
  } = {}) {
    const reportText = requiredCallback(onText);
    const reportState = requiredCallback(onStateChange);
    const reportError = requiredCallback(onError);
    const supported = typeof RecognitionConstructor === "function";
    let recognition = null;
    let listening = false;
    let baseText = "";

    function finish() {
      const wasListening = listening;
      listening = false;
      recognition = null;
      if (wasListening) reportState("idle");
    }

    function start(currentText = "") {
      if (!supported || listening) return false;

      baseText = String(currentText || "").trim();
      recognition = new RecognitionConstructor();
      recognition.lang = language;
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.onstart = () => reportState("listening");
      recognition.onresult = (event) => {
        const results = Array.from(event?.results || []);
        const transcript = results
          .map((result) => String(result?.[0]?.transcript || "").trim())
          .filter(Boolean)
          .join(" ");
        const text = [baseText, transcript].filter(Boolean).join(" ");
        reportText(text, { final: results.some((result) => result.isFinal === true) });
      };
      recognition.onerror = (event) => reportError(String(event?.error || "unknown"));
      recognition.onend = finish;
      listening = true;

      try {
        recognition.start();
        return true;
      } catch {
        listening = false;
        recognition = null;
        reportError("start-failed");
        reportState("idle");
        return false;
      }
    }

    function stop() {
      if (!listening || !recognition) return false;
      recognition.stop();
      return true;
    }

    function toggle(currentText = "") {
      if (listening) {
        stop();
        return false;
      }
      return start(currentText);
    }

    return {
      supported,
      isListening: () => listening,
      start,
      stop,
      toggle,
    };
  }

  function createSpeechController({
    fetchImpl = globalThis.fetch,
    AudioConstructor = globalThis.Audio,
    createObjectURL = globalThis.URL?.createObjectURL?.bind(globalThis.URL),
    revokeObjectURL = globalThis.URL?.revokeObjectURL?.bind(globalThis.URL),
    endpoint = "/api/safer-tts",
    playbackRate = 1.2,
    onError,
  } = {}) {
    const supported = Boolean(
      typeof fetchImpl === "function"
      && typeof AudioConstructor === "function"
      && typeof createObjectURL === "function"
    );
    const reportError = requiredCallback(onError);
    const normalizedPlaybackRate = Number.isFinite(playbackRate)
      ? Math.min(2, Math.max(0.5, playbackRate))
      : 1.2;
    let active = null;

    function cleanup(target) {
      if (target.audio) {
        target.audio.onended = null;
        target.audio.onerror = null;
      }
      if (target.objectUrl && typeof revokeObjectURL === "function") revokeObjectURL(target.objectUrl);
    }

    function markIdle(target) {
      if (active !== target) return;
      active = null;
      cleanup(target);
      target.onStateChange("idle");
    }

    function cancel() {
      if (!active || !supported) return false;
      const target = active;
      active = null;
      target.abortController.abort();
      target.audio?.pause?.();
      cleanup(target);
      target.onStateChange("idle");
      return true;
    }

    async function loadAndPlay(target) {
      try {
        const response = await fetchImpl(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ text: target.text }),
          signal: target.abortController.signal,
        });
        if (!response.ok) throw new Error("TTS request failed");
        const blob = await response.blob();
        if (active !== target) return;
        target.objectUrl = createObjectURL(blob);
        target.audio = new AudioConstructor(target.objectUrl);
        target.audio.playbackRate = normalizedPlaybackRate;
        if ("preservesPitch" in target.audio) target.audio.preservesPitch = true;
        if ("webkitPreservesPitch" in target.audio) target.audio.webkitPreservesPitch = true;
        if ("mozPreservesPitch" in target.audio) target.audio.mozPreservesPitch = true;
        target.audio.onended = () => markIdle(target);
        target.audio.onerror = () => {
          markIdle(target);
          reportError("음성을 재생하지 못했습니다. 다시 시도해 주세요.");
        };
        target.onStateChange("speaking");
        await target.audio.play();
      } catch (error) {
        if (target.abortController.signal.aborted || active !== target) return;
        markIdle(target);
        reportError("음성을 생성하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      }
    }

    function toggle({ id, text, onStateChange } = {}) {
      if (!supported) return "unavailable";
      if (active?.id === id) {
        cancel();
        return "stopped";
      }
      cancel();
      const normalizedText = String(text || "").trim();
      if (!normalizedText) return "unavailable";
      const target = {
        id,
        text: normalizedText,
        onStateChange: requiredCallback(onStateChange),
        abortController: new AbortController(),
        audio: null,
        objectUrl: "",
      };
      active = target;
      target.onStateChange("loading");
      loadAndPlay(target);
      return "loading";
    }

    return { supported, cancel, toggle, isActive: (id) => active?.id === id };
  }

  return {
    createDictationController,
    createSpeechController,
  };
});
