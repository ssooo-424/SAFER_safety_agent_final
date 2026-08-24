const path = require("path");

function registerPageRoutes(app, rootDir) {
  app.get("/", (req, res) => res.sendFile(path.join(rootDir, "public", "index.html")));
  app.get("/safer", (req, res) => res.sendFile(path.join(rootDir, "public", "safer.html")));
}

module.exports = { registerPageRoutes };
