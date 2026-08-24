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
    speechSynthesis,
    UtteranceConstructor,
    language = "ko-KR",
  } = {}) {
    const supported = Boolean(
      speechSynthesis
      && typeof speechSynthesis.speak === "function"
      && typeof speechSynthesis.cancel === "function"
      && typeof UtteranceConstructor === "function"
    );
    let active = null;

    function markIdle(target) {
      if (active !== target) return;
      active = null;
      target.onStateChange("idle");
    }

    function cancel() {
      if (!active || !supported) return false;
      const target = active;
      active = null;
      speechSynthesis.cancel();
      target.onStateChange("idle");
      return true;
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

      const utterance = new UtteranceConstructor(normalizedText);
      utterance.lang = language;
      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.volume = 1;
      const voices = typeof speechSynthesis.getVoices === "function"
        ? speechSynthesis.getVoices()
        : [];
      utterance.voice = voices.find((voice) => String(voice.lang || "").toLowerCase().startsWith("ko")) || null;

      const target = {
        id,
        onStateChange: requiredCallback(onStateChange),
        utterance,
      };
      active = target;
      utterance.onend = () => markIdle(target);
      utterance.onerror = () => markIdle(target);
      target.onStateChange("speaking");
      speechSynthesis.speak(utterance);
      return "speaking";
    }

    return {
      supported,
      cancel,
      toggle,
      isActive: (id) => active?.id === id,
    };
  }

  return {
    createDictationController,
    createSpeechController,
  };
});
