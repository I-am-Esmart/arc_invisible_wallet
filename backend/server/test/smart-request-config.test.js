const assert = require("node:assert/strict");
const test = require("node:test");
const {
  ZERO_ADDRESS,
  buildSmartRequestContractConfig,
  normalizeVeloxPayRequestsContractAddress,
  requireSmartRequestContractConfig
} = require("../smart-request-config");

test("Smart Request contract config rejects missing and empty addresses", () => {
  for (const value of [undefined, null, "", "   "]) {
    assert.equal(normalizeVeloxPayRequestsContractAddress(value), "");
    const config = buildSmartRequestContractConfig(value);
    assert.equal(config.available, false);
    assert.match(config.message, /VELOXPAY_REQUESTS_CONTRACT_ADDRESS/);
    assert.throws(() => requireSmartRequestContractConfig(value), {
      code: "smart_request_contract_not_configured",
      statusCode: 503
    });
  }
});

test("Smart Request contract config rejects malformed addresses", () => {
  for (const value of ["not-an-address", "0x1234", "0xzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz"]) {
    assert.equal(normalizeVeloxPayRequestsContractAddress(value), "");
    assert.equal(buildSmartRequestContractConfig(value).available, false);
    assert.throws(() => requireSmartRequestContractConfig(value), {
      code: "smart_request_contract_not_configured",
      statusCode: 503
    });
  }
});

test("Smart Request contract config rejects the zero address", () => {
  assert.equal(normalizeVeloxPayRequestsContractAddress(ZERO_ADDRESS), "");
  assert.equal(buildSmartRequestContractConfig(ZERO_ADDRESS).available, false);
  assert.throws(() => requireSmartRequestContractConfig(ZERO_ADDRESS), {
    code: "smart_request_contract_not_configured",
    statusCode: 503
  });
});

test("Smart Request contract config accepts valid nonzero EVM addresses", () => {
  const address = "0x1111111111111111111111111111111111111111";
  const config = buildSmartRequestContractConfig(address);

  assert.equal(config.available, true);
  assert.equal(config.contractAddress, address);
  assert.equal(requireSmartRequestContractConfig(address).contractAddress, address);
});
