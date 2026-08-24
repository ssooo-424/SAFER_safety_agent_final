const fs = require("fs");
const path = require("path");

function writeJson(directory, filename, value) {
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, filename), JSON.stringify(value, null, 2), "utf-8");
}

function registerParticipantRoutes(app, { store, sessionRequests, dataRoot }) {
  app.post("/api/submit", sessionRequests.enforceSubmitRateLimit, async (req, res) => {
    try {
      const { participantId: ignoredParticipantId, ...submittedPayload } = req.body || {};
      const submittedScenarioRowId = submittedPayload?.incident?.scenarioRowId;
      if (submittedScenarioRowId === null || submittedScenarioRowId === undefined || String(submittedScenarioRowId).trim() === "") {
        return res.status(400).json({ ok: false, error: "scenarioRowId required" });
      }
      const session = await store.createSession({
        submissionKey: sessionRequests.getRequestId(req),
        data: { preSurvey: submittedPayload, scenarioRowId: submittedScenarioRowId }
      });
      const scenarioRowId = session.data.scenarioRowId;
      const filename = `${session.participantId}.json`;
      const record = {
        ok: true,
        participantId: session.participantId,
        condition: session.condition,
        assignmentMode: session.assignmentMode,
        scenarioId: scenarioRowId,
        scenarioRowId,
        receivedAt: session.createdAt
      };
      const dataDir = dataRoot ? path.join(dataRoot, "data") : null;
      if (dataDir) writeJson(dataDir, filename, record);
      res.cookie("safer_session", session.sessionId, {
        httpOnly: true,
        sameSite: "lax",
        secure: req.secure,
        path: "/"
      });
      return res.json({ ...record, savedAs: dataDir ? filename : null });
    } catch (error) {
      return sessionRequests.publicRequestError(req, res, error);
    }
  });

  app.post("/api/submit-post-survey", async (req, res) => {
    let context;
    try {
      context = await sessionRequests.beginSessionRequest(req, res, "post");
      if (!context) return;
      const { session, requestId, request } = context;
      const preSurvey = session.data.preSurvey || {};
      const clientAnswers = Object.fromEntries(
        Object.entries(req.body || {}).filter(
          ([key]) => !["sessionId", "participantId", "condition", "scenarioId", "scenarioRowId", "name", "org"].includes(key)
        )
      );
      const authoritativePayload = {
        ...clientAnswers,
        participantId: session.participantId,
        condition: session.condition,
        scenarioRowId: session.data.scenarioRowId,
        name: preSurvey.profile?.name || "",
        org: preSurvey.profile?.org || ""
      };
      const filename = `${session.participantId}.json`;
      const surveyDir = dataRoot ? path.join(dataRoot, "survey") : null;
      const response = {
        ok: true,
        filename: surveyDir ? filename : null,
        participantId: session.participantId,
        condition: session.condition,
        scenarioRowId: session.data.scenarioRowId,
        message: "사후 설문 데이터가 정상적으로 저장되었습니다."
      };
      const completedRequest = await store.completeRequest(session.sessionId, {
        requestId,
        leaseGeneration: request.leaseGeneration,
        response,
        sessionData: { postSurvey: authoritativePayload }
      });
      if (surveyDir && completedRequest.leaseGeneration === request.leaseGeneration) {
        try {
          writeJson(surveyDir, filename, authoritativePayload);
        } catch (error) {
          console.error("Compatibility survey export failed", {
            participantId: session.participantId,
            error: sessionRequests.errorMetadata(error)
          });
        }
      }
      return res.json(completedRequest.response);
    } catch (error) {
      if (context) await sessionRequests.failStartedRequest(context.session.sessionId, context.requestId, context.request);
      return sessionRequests.publicRequestError(req, res, error);
    }
  });
}

module.exports = { registerParticipantRoutes };
