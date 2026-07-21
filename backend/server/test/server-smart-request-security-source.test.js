const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const serverSource = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");

function routeBody(method, route) {
  const marker = `app.${method}("${route}"`;
  const start = serverSource.indexOf(marker);

  assert.notEqual(start, -1, `Missing route ${method.toUpperCase()} ${route}`);

  const nextRoute = serverSource.indexOf("\napp.", start + marker.length);
  return serverSource.slice(start, nextRoute === -1 ? serverSource.length : nextRoute);
}

test("Smart Request payer verification rejects mismatched expected payer email before wallet assignment", () => {
  const body = routeBody("post", "/smart-requests/:id/verify-payer");

  assert.match(body, /requireExpectedSmartRequestPayer\(smartRequest, payerEmail\)/);
  assert.match(body, /actualPayerEmail:\s*payerEmail/);
});

test("Smart Request money-moving routes require authorized payer wallet binding", () => {
  for (const route of [
    "/smart-requests/:id/check-balance",
    "/smart-requests/:id/bridge/quote",
    "/smart-requests/:id/bridge/execute",
    "/smart-requests/:id/bridge/resume",
    "/smart-requests/:id/check-allowance",
    "/smart-requests/:id/approve-token",
    "/smart-requests/:id/pay",
    "/smart-requests/:id/resume",
    "/smart-requests/:id/approve-release",
    "/smart-requests/:id/claim-expired-refund"
  ]) {
    assert.match(routeBody("post", route), /resolveAuthorizedPayerForSmartRequest\(/, route);
  }
});

test("Smart Request bridge execution guards against duplicate bridge starts", () => {
  const body = routeBody("post", "/smart-requests/:id/bridge/execute");

  assert.match(body, /hasBridgeExecutionStarted\(smartRequest\.bridge\)/);
  assert.match(body, /Resume instead of starting another bridge/);
});
