const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const publicDirectory = path.join(__dirname, "..", "public");
const voiceClientPath = path.join(publicDirectory, "voice-client.js");

class FakeRecognition {
  static instances = [];

  constructor() {
    FakeRecognition.instances.push(this);
    this.lang = "";
    this.continuous = true;
    this.interimResults = false;
  }

  start() {
    this.onstart?.();
  }

  stop() {
    this.onend?.();
  }

  emitResult(parts) {
    const results = parts.map(({ transcript, final }) => {
      const result = [{ transcript }];
      result.isFinal = final;
      return result;
    });
    this.onresult?.({ results });
  }

  emitError(error) {
    this.onerror?.({ error });
    this.onend?.();
  }
}

class FakeAudio {
  static instances = [];

  constructor(url) {
    this.url = url;
    this.paused = false;
    this.preservesPitch = false;
    FakeAudio.instances.push(this);
  }

  async play() {}

  pause() {
    this.paused = true;
  }
}

function loadVoiceClient() {
  delete require.cache[require.resolve(voiceClientPath)];
  return require(voiceClientPath);
}

test("dictation appends Korean recognition to editable text without submitting or storing audio", () => {
  const { createDictationController } = loadVoiceClient();
  const texts = [];
  const states = [];
  const errors = [];
  const controller = createDictationController({
    RecognitionConstructor: FakeRecognition,
    onText: (text, details) => texts.push({ text, ...details }),
    onStateChange: (state) => states.push(state),
    onError: (error) => errors.push(error),
  });

  assert.equal(controller.supported, true);
  assert.equal(controller.toggle("기존 입력"), true);
  const recognition = FakeRecognition.instances.at(-1);
  assert.equal(recognition.lang, "ko-KR");
  assert.equal(recognition.continuous, false);
  assert.equal(recognition.interimResults, true);
  assert.deepEqual(states, ["listening"]);

  recognition.emitResult([
    { transcript: "안전모를 ", final: false },
    { transcript: "착용한다", final: true },
  ]);
  assert.deepEqual(texts.at(-1), {
    text: "기존 입력 안전모를 착용한다",
    final: true,
  });
  assert.deepEqual(errors, []);

  controller.stop();
  assert.equal(states.at(-1), "idle");
});

test("dictation exposes browser errors and keeps unsupported browsers on the keyboard path", () => {
  const { createDictationController } = loadVoiceClient();
  const errors = [];
  const controller = createDictationController({
    RecognitionConstructor: FakeRecognition,
    onText() {},
    onStateChange() {},
    onError: (error) => errors.push(error),
  });
  controller.toggle("");
  FakeRecognition.instances.at(-1).emitError("not-allowed");
  assert.deepEqual(errors, ["not-allowed"]);
  assert.equal(controller.isListening(), false);

  const unsupported = createDictationController({
    RecognitionConstructor: null,
    onText() {},
    onStateChange() {},
    onError() {},
  });
  assert.equal(unsupported.supported, false);
  assert.equal(unsupported.toggle("키보드 입력"), false);
});

test("speech output requests OpenAI audio, is stoppable, and stays exclusive to one message", async () => {
  const { createSpeechController } = loadVoiceClient();
  const requests = [];
  const revoked = [];
  const fetchImpl = async (url, options) => {
    requests.push({ url, options });
    return { ok: true, blob: async () => new Blob(["mp3"], { type: "audio/mpeg" }) };
  };
  const firstStates = [];
  const secondStates = [];
  const controller = createSpeechController({
    fetchImpl,
    AudioConstructor: FakeAudio,
    createObjectURL: () => `blob:audio-${requests.length}`,
    revokeObjectURL: value => revoked.push(value),
  });

  assert.equal(controller.supported, true);
  assert.equal(controller.toggle({
    id: "message-1",
    text: "안전수칙을 확인하세요.",
    onStateChange: (state) => firstStates.push(state),
  }), "loading");
  assert.deepEqual(firstStates, ["loading"]);
  await new Promise(setImmediate);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "/api/safer-tts");
  assert.deepEqual(JSON.parse(requests[0].options.body), { text: "안전수칙을 확인하세요." });
  assert.deepEqual(firstStates, ["loading", "speaking"]);
  assert.equal(FakeAudio.instances[0].playbackRate, 1.2);
  assert.equal(FakeAudio.instances[0].preservesPitch, true);

  assert.equal(controller.toggle({
    id: "message-2",
    text: "두 번째 안내입니다.",
    onStateChange: (state) => secondStates.push(state),
  }), "loading");
  assert.equal(firstStates.at(-1), "idle");
  await new Promise(setImmediate);
  assert.equal(requests.length, 2);
  assert.equal(FakeAudio.instances[0].paused, true);

  assert.equal(controller.toggle({
    id: "message-2",
    text: "두 번째 안내입니다.",
    onStateChange: (state) => secondStates.push(state),
  }), "stopped");
  assert.equal(secondStates.at(-1), "idle");
  assert.ok(revoked.length >= 1);
});

test("SAFER chat wires optional dictation and assistant-only TTS without an audio upload path", () => {
  const html = fs.readFileSync(path.join(publicDirectory, "safer.html"), "utf8");
  const script = fs.readFileSync(path.join(publicDirectory, "safer.js"), "utf8");
  const voiceClient = fs.readFileSync(voiceClientPath, "utf8");

  assert.match(
    html,
    /<script src="\/api-client\.js" defer><\/script>\s*<script src="\/voice-client\.js" defer><\/script>\s*<script src="\/safer\.js" defer><\/script>/,
  );
  assert.match(html, /id="voice-input-button"/);
  assert.match(html, /aria-label="음성으로 답변 입력"/);
  assert.match(script, /window\.SaferVoice/);
  assert.match(script, /const inputMethod\s*=\s*state\.inputMethod/);
  assert.match(script, /userMessage:\s*answer,[\s\S]*?inputMethod/);
  assert.match(voiceClient, /\/api\/safer-tts/);
  assert.doesNotMatch(`${html}\n${script}`, /MediaRecorder|FormData|audio\/webm/i);
});
