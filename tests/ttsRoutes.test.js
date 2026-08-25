const assert = require("node:assert/strict");
const express = require("express");
const http = require("node:http");
const test = require("node:test");

const { getTtsProfile, normalizeTtsText, registerTtsRoutes } = require("../runtime/ttsRoutes");

test("TTS profiles keep the approved model voices and Korean delivery instructions", () => {
  const educator = getTtsProfile("educator");
  const coworker = getTtsProfile("coworker");
  const futureSelf = getTtsProfile("future_self");

  assert.equal(educator.voice, "cedar");
  assert.match(educator.instructions, /차분하고 신뢰감 있게/);
  assert.equal(coworker.voice, "cedar");
  assert.match(coworker.instructions, /현장 동료/);
  assert.equal(futureSelf.voice, "cedar");
  assert.match(futureSelf.instructions, /낮고 진지하게/);
});

test("TTS input is normalized and bounded", () => {
  assert.equal(normalizeTtsText("  안전하게\n작업하세요.  "), "안전하게 작업하세요.");
  assert.throws(() => normalizeTtsText(""), /TTS text required/);
  assert.throws(() => normalizeTtsText("가".repeat(2001)), /TTS text too long/);
});

test("TTS route chooses the server-side persona voice and returns MP3", async () => {
  const app = express();
  app.use(express.json());
  const calls = [];
  let released = false;
  registerTtsRoutes(app, {
    model: "gpt-4o-mini-tts",
    openai: {
      audio: {
        speech: {
          create: async payload => {
            calls.push(payload);
            return { arrayBuffer: async () => Uint8Array.from([1, 2, 3]).buffer };
          }
        }
      }
    },
    sessionRequests: {
      requireSession: async () => ({ condition: "coworker" }),
      admitLlmRequest: () => () => { released = true; },
      publicRequestError: (_req, res) => res.status(500).json({ ok: false })
    }
  });
  const server = http.createServer(app);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  try {
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/api/safer-tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "  오늘 작업은 위험했어.  ", voice: "cedar" })
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "audio/mpeg");
    assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], [1, 2, 3]);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].model, "gpt-4o-mini-tts");
    assert.equal(calls[0].voice, "cedar");
    assert.equal(calls[0].input, "오늘 작업은 위험했어.");
    assert.match(calls[0].instructions, /현장 동료/);
    assert.equal(released, true);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
