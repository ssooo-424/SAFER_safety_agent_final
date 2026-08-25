function parseOpenAiJson(completion) {
  const rawText = completion.choices?.[0]?.message?.content?.trim() || "";
  return JSON.parse(
    rawText.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim()
  );
}

function stripRepeatedCoworkerExperience(value, repeatedExperience) {
  const text = String(value || "").trim();
  const repeated = String(repeatedExperience || "").trim();
  if (!text || !repeated) return text;
  return text
    .split(repeated)
    .join("")
    .replace(/\s+([.!?])/g, "$1")
    .replace(/^[.!?\s]+/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

const {
  getExperimentalOutcomeForSafetyCase,
  ensureExperimentalInjuryText,
  sanitizeGeneratedOutcomeText
} = require("../llm/experimentalOutcome");
const {
  STANDARDIZED_ORGANIZATIONAL_OUTCOME,
  buildStandardizedOrganizationalOutcomeMessages
} = require("../llm/standardizedOrganizationalOutcome");
const { normalizeTurnTimings } = require("./turnTiming");

function registerSaferRoutes(app, dependencies) {
  const {
    store,
    openai,
    model,
    sessionRequests,
    buildSafetyCaseFromPayload,
    prompts,
    googleSheetsSync
  } = dependencies;

  app.post("/api/safer-timing", async (req, res) => {
    try {
      const session = await sessionRequests.requireSession(req, res);
      if (!session) return;
      const received = normalizeTurnTimings(req.body?.turnTimings);
      const turnTimings = { ...(session.data.turnTimings || {}), ...received };
      await store.updateSession(session.sessionId, { data: { turnTimings } });
      void googleSheetsSync?.syncSessionById(session.sessionId);
      return res.json({ ok: true });
    } catch (error) {
      return sessionRequests.publicRequestError(req, res, error);
    }
  });

  app.post("/api/safer-start", async (req, res) => {
    let context;
    try {
      context = await sessionRequests.beginSessionRequest(req, res, "start");
      if (!context) return;
      const { session, requestId, request } = context;
      const payload = session.data.preSurvey;
      const scenarioRowId = session.data.scenarioRowId;
      const result = buildSafetyCaseFromPayload({ payload, scenarioId: String(scenarioRowId) });
      if (!result.selectedCase || !result.scenarioRulesResult || !result.safetyCase) {
        throw new Error("SAFETY_CASE를 생성하지 못했습니다.");
      }
      const greeting = prompts.buildSaferTurn0Greeting({
        condition: session.condition,
        profile: payload.profile || {},
        safetyCase: result.safetyCase
      });
      const response = {
        ok: true,
        condition: session.condition,
        scenarioId: scenarioRowId,
        scenarioRowId,
        turn0: {
          turn: 0,
          assistant: greeting.assistant,
          generatedBy: "deterministic",
          context: greeting.context || {}
        },
        safetyCase: result.safetyCase,
        imagePath: result.safetyCase.actual_case?.image_path || null
      };
      const completedRequest = await store.completeRequest(session.sessionId, {
        requestId,
        leaseGeneration: request.leaseGeneration,
        response,
        sessionData: { safetyCase: result.safetyCase, turn0: response.turn0 }
      });
      return res.json(completedRequest.response);
    } catch (error) {
      if (context) {
        await sessionRequests.failStartedRequest(context.session.sessionId, context.requestId, context.request);
      }
      return sessionRequests.publicRequestError(req, res, error);
    }
  });

  app.post("/api/safer-intro", async (req, res) => {
    let context;
    try {
      context = await sessionRequests.beginSessionRequest(req, res, "intro", undefined, true);
      if (!context) return;
      const { session, requestId, request } = context;
      const payload = session.data.preSurvey;
      const safetyCase = session.data.safetyCase;
      const messages = prompts.buildSaferIntroMessages({
        condition: session.condition,
        safetyCase,
        participantContext: payload
      });
      const completion = await openai.chat.completions.create({
        model,
        messages,
        temperature: 0.2
      });
      const script = parseOpenAiJson(completion);
      const outcomePolicy = getExperimentalOutcomeForSafetyCase(safetyCase);
      const sanitize = value => sanitizeGeneratedOutcomeText(value, outcomePolicy);
      const saferAgent = prompts.getSaferAgent(session.condition);
      const generatedTurn1 = sanitize(String(script?.turn1 || "").trim());
      const repeatedCoworkerExperience = session.condition === "coworker"
        ? saferAgent.persona?.persona_manipulation?.standardized_peer_experience
        : "";
      const turn1 = stripRepeatedCoworkerExperience(
        generatedTurn1,
        repeatedCoworkerExperience
      );
      const turn2 = sanitize(String(script?.turn2 || "").trim());
      const turn3 = ensureExperimentalInjuryText(
        sanitize(String(script?.turn3 || "").trim()),
        safetyCase,
        session.condition
      );
      if (!turn1 || !turn2 || !turn3) {
        throw new Error("SAFER Intro Turn 1~3 생성 결과가 완전하지 않습니다.");
      }
      const turn3Messages = [turn3];
      if (typeof saferAgent.buildTurn3ConsequenceMessages === "function") {
        const additions = saferAgent.buildTurn3ConsequenceMessages({
          safetyCase,
          participantContext: payload
        });
        if (Array.isArray(additions)) {
          turn3Messages.push(...additions.map(value => sanitize(String(value || "").trim())).filter(Boolean));
        }
      } else if (typeof saferAgent.buildTurn3ConsequenceExtension === "function") {
        const extension = String(
          saferAgent.buildTurn3ConsequenceExtension({ safetyCase, participantContext: payload }) || ""
        ).trim();
        if (extension) turn3Messages.push(sanitize(extension));
      }
      const organizationalOutcomeMessages = buildStandardizedOrganizationalOutcomeMessages(
        session.condition
      );
      const introScript = {
        turn1,
        turn2,
        turn3,
        turn3Messages,
        organizationalOutcome: STANDARDIZED_ORGANIZATIONAL_OUTCOME,
        organizationalOutcomeMessages
      };
      const response = { ok: true, condition: session.condition, script: introScript };
      const completedRequest = await store.completeRequest(session.sessionId, {
        requestId,
        leaseGeneration: request.leaseGeneration,
        response,
        sessionData: { introScript }
      });
      return res.json(completedRequest.response);
    } catch (error) {
      if (context) {
        await sessionRequests.failStartedRequest(context.session.sessionId, context.requestId, context.request);
      }
      return sessionRequests.publicRequestError(req, res, error);
    } finally {
      context?.releaseLlm?.();
    }
  });

  app.post("/api/safer-chat", async (req, res) => {
    let context;
    try {
      const turn = Number(req.body?.turn);
      if (!Number.isInteger(turn) || turn < 4 || turn > 6) {
        return res.status(400).json({ ok: false, error: "turn must be an integer from 4 to 6" });
      }
      context = await sessionRequests.beginSessionRequest(req, res, "chat", turn, turn === 5);
      if (!context) return;
      const { session, requestId, request } = context;
      const payload = session.data.preSurvey;
      const safetyCase = session.data.safetyCase;
      const condition = session.condition;
      const userMessage = turn === 5 ? String(req.body?.userMessage || "") : "";
      const inputMethod = turn === 5 && req.body?.inputMethod === "dictation" ? "dictation" : "keyboard";
      let response;

      if (turn === 4) {
        response = {
          ok: true,
          condition,
          turn,
          assistant: prompts.getSaferTurn4Question({ condition, safetyCase, participantContext: payload }),
          generatedBy: "fixed"
        };
      } else if (turn === 5) {
        if (!Array.isArray(safetyCase?.safety_rules) || safetyCase.safety_rules.length !== 3) {
          throw new Error("Turn 5 evaluation requires exactly 3 safety_rules");
        }
        const completion = await openai.chat.completions.create({
          model,
          messages: prompts.buildSaferTurn5EvaluationMessages({ condition, safetyCase, userMessage }),
          temperature: 0
        });
        const feedback = prompts.buildSaferTurn5Feedback({
          condition,
          safetyCase,
          userMessage,
          evaluation: parseOpenAiJson(completion),
          participantContext: payload
        });
        response = {
          ok: true,
          condition,
          turn,
          assistant: feedback.assistant,
          generatedBy: "llm-evaluation+deterministic-feedback",
          evaluation: {
            coverage: feedback.coverage,
            coveredRuleIds: feedback.coveredRuleIds,
            missingRuleIds: feedback.missingRuleIds,
            coveredCount: feedback.coveredCount,
            missingCount: feedback.missingCount
          }
        };
      } else {
        if (!Array.isArray(safetyCase?.safety_rules) || safetyCase.safety_rules.length !== 3) {
          throw new Error("Turn 6 requires exactly 3 safety_rules");
        }
        const feedback = prompts.buildSaferTurn6Feedback({ condition, safetyCase });
        response = {
          ok: true,
          condition,
          turn,
          assistant: feedback.assistant,
          generatedBy: "deterministic",
          safetyRules: feedback.safetyRules
        };
      }

      const turnData = turn === 5 ? { userMessage, inputMethod, response } : response;
      const completedRequest = await store.completeRequest(session.sessionId, {
        requestId,
        leaseGeneration: request.leaseGeneration,
        response,
        sessionData: { [`turn${turn}`]: turnData }
      });
      return res.json(completedRequest.response);
    } catch (error) {
      if (context) {
        await sessionRequests.failStartedRequest(context.session.sessionId, context.requestId, context.request);
      }
      return sessionRequests.publicRequestError(req, res, error);
    } finally {
      context?.releaseLlm?.();
    }
  });
}

module.exports = { registerSaferRoutes, stripRepeatedCoworkerExperience };
