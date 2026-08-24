const assert = require("node:assert/strict");
const test = require("node:test");

process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "test-key";

const serverModule = require("../server");

test("retired participant pages and scripts are not publicly reachable", async t => {
  await serverModule.ready;

  const listener = serverModule.app.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    listener.once("listening", resolve);
    listener.once("error", reject);
  });
  t.after(() => new Promise(resolve => listener.close(resolve)));

  const address = listener.address();
  const paths = [
    "/choice",
    "/c1",
    "/c2",
    "/c3",
    "/followup",
    "/next",
    "/choice.html",
    "/c1.html",
    "/c2.html",
    "/c3.html",
    "/next.html",
    "/next.js",
    "/c1.js",
    "/c2.js"
  ];

  for (const path of paths) {
    const response = await fetch(`http://127.0.0.1:${address.port}${path}`);
    assert.equal(response.status, 404, `${path} must remain retired`);
  }
});
