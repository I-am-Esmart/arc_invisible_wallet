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

test("Smart Request payer verification accepts signed link token for short-code links", () => {
  assert.match(serverSource, /const linkTokenMatches = Boolean/);
  assert.match(serverSource, /challenge\.linkId !== linkId && !linkTokenMatches/);
  assert.match(serverSource, /challenge\.linkToken && linkToken && !linkTokenMatches/);
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

test("Creator protected refund route requires payee ownership and creator refund mode", () => {
  const body = routeBody("post", "/smart-requests/:id/refund-by-creator");

  assert.match(body, /canRefundProtectedByCreator\(smartRequest, actorEmail\)/);
  assert.match(body, /refundMode:\s*"creator"/);
  assert.match(body, /Payee Circle wallet is required/);
  assert.match(body, /payment\.status\s*=\s*"refunded"/);
});

test("Expired protected refund route updates the payment record", () => {
  const body = routeBody("post", "/smart-requests/:id/claim-expired-refund");

  assert.match(body, /canClaimExpiredProtectedRefund\(smartRequest, actorEmail\)/);
  assert.match(body, /refundMode:\s*"expired"/);
  assert.match(body, /payment\.status\s*=\s*"refunded"/);
  assert.match(body, /savePersistentPayment\(payment\)/);
});

test("Smart Request bridge execution guards against duplicate bridge starts", () => {
  const body = routeBody("post", "/smart-requests/:id/bridge/execute");

  assert.match(body, /hasBridgeExecutionStarted\(smartRequest\.bridge\)/);
  assert.match(body, /Resume instead of starting another bridge/);
});

test("Smart Request creation requires a configured nonzero contract before persisting", () => {
  const body = routeBody("post", "/smart-requests");
  const configCheckIndex = body.indexOf("requireSmartRequestContractConfig(VELOXPAY_REQUESTS_CONTRACT_ADDRESS)");
  const paymentLinkPersistIndex = body.indexOf("await syncStoredPaymentLink(store, paymentLink)");
  const smartRequestPersistIndex = body.indexOf("await smartRequestRepository.save(smartRequest)");

  assert.notEqual(configCheckIndex, -1);
  assert.notEqual(paymentLinkPersistIndex, -1);
  assert.notEqual(smartRequestPersistIndex, -1);
  assert.ok(configCheckIndex < paymentLinkPersistIndex);
  assert.ok(configCheckIndex < smartRequestPersistIndex);
  assert.doesNotMatch(body, /0x0000000000000000000000000000000000000000/);
});

test("Backend readiness exposes Smart Request contract availability", () => {
  assert.match(serverSource, /id:\s*"smart_request_contract"/);
  assert.match(serverSource, /smartRequests:\s*SMART_REQUEST_CONTRACT_CONFIG\.available/);
  assert.match(serverSource, /smartRequestsMessage:\s*SMART_REQUEST_CONTRACT_CONFIG\.message/);
});

test("Serverless production writes require durable storage", () => {
  assert.match(serverSource, /const IS_SERVERLESS_TEMP_STORE = Boolean/);
  assert.match(serverSource, /Durable storage is required for VeloxPay production writes/);
  assert.match(serverSource, /\/tmp storage is not durable/);
});

test("Create wallet persists newly created Circle wallet users before returning", () => {
  const body = routeBody("post", "/create-wallet");
  const ensureIndex = body.indexOf("const user = await ensureUserRecord");
  const earlyReturnIndex = body.indexOf("return res.json(mapStoredUser(user));");
  const writeBeforeReturnIndex = body.indexOf("writeStore(store);", ensureIndex);

  assert.notEqual(ensureIndex, -1);
  assert.notEqual(earlyReturnIndex, -1);
  assert.notEqual(writeBeforeReturnIndex, -1);
  assert.ok(writeBeforeReturnIndex < earlyReturnIndex);
});
