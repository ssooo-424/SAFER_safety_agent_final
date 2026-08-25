const TTS_PROFILES = Object.freeze({
  educator: Object.freeze({
    voice: "cedar",
    instructions: "차분하고 신뢰감 있게, 또렷하게 말하세요. 전문적인 안전교육자의 존댓말을 유지하고 감정을 과장하지 마세요."
  }),
  coworker: Object.freeze({
    voice: "cedar",
    instructions: "자연스러운 현장 동료의 말투로, 과장 없이 담담하게 말하세요. 친근한 반말을 유지하세요."
  }),
  future_self: Object.freeze({
    voice: "cedar",
    instructions: "낮고 진지하게 말하되 감정을 과장하지 마세요. 3년 후의 내가 현재의 나에게 말하는 자연스러운 반말을 유지하세요."
  })
});

function getTtsProfile(condition) {
  const profile = TTS_PROFILES[condition];
  if (!profile) throw new Error("unsupported SAFER condition");
  return profile;
}

function normalizeTtsText(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) throw new Error("TTS text required");
  if (text.length > 2000) throw new Error("TTS text too long");
  return text;
}

function registerTtsRoutes(app, { openai, sessionRequests, model = "gpt-4o-mini-tts" }) {
  app.post("/api/safer-tts", async (req, res) => {
    let releaseLlm;
    try {
      const session = await sessionRequests.requireSession(req, res);
      if (!session) return;
      releaseLlm = sessionRequests.admitLlmRequest(req, res);
      if (!releaseLlm) return;

      const text = normalizeTtsText(req.body?.text);
      const profile = getTtsProfile(session.condition);
      const speech = await openai.audio.speech.create({
        model,
        voice: profile.voice,
        input: text,
        instructions: profile.instructions,
        response_format: "mp3"
      });
      const audio = Buffer.from(await speech.arrayBuffer());
      res.set({
        "Content-Type": "audio/mpeg",
        "Content-Length": String(audio.length),
        "Cache-Control": "private, no-store, max-age=0"
      });
      return res.send(audio);
    } catch (error) {
      if (String(error?.message || "").includes("TTS text")) {
        return res.status(400).json({ ok: false, error: "읽을 수 있는 메시지가 필요합니다." });
      }
      return sessionRequests.publicRequestError(req, res, error);
    } finally {
      releaseLlm?.();
    }
  });
}

module.exports = { TTS_PROFILES, getTtsProfile, normalizeTtsText, registerTtsRoutes };
