function registerScenarioRoutes(app, catalog) {
  app.get("/api/scenarios", (req, res) => {
    const { major, detail } = req.query;
    if (!major || !detail) {
      return res.status(400).json({ ok: false, error: "major와 detail 파라미터가 필요합니다." });
    }
    const scenarios = catalog.selectForParticipant(major, detail);
    if (scenarios.length === 0) {
      return res.json({
        ok: false,
        error: `해당 공정의 시나리오를 찾을 수 없습니다: ${major} > ${detail}`,
        scenarios: []
      });
    }
    return res.json({
      ok: true,
      scenarios: scenarios.map(item => ({
        id: item.id,
        scenario: item.scenario,
        primaryAccident: item.primaryAccident,
        accidents: item.accidents,
        riskLevel: item.riskLevel,
        canonicalPrimaryAccident: item.canonicalPrimaryAccident,
        processContent: item.processContent
      }))
    });
  });
}

module.exports = { registerScenarioRoutes };
