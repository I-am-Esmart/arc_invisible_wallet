const assert = require("node:assert/strict");
const test = require("node:test");
const {
  createSmartRequestBridgeService
} = require("../smart-request-bridge-service");

const SOURCE = "0x1111111111111111111111111111111111111111";
const DESTINATION = "0x2222222222222222222222222222222222222222";
const BURN_HASH = `0x${"a".repeat(64)}`;
const MINT_HASH = `0x${"b".repeat(64)}`;

function createMockContext({ bridgeState = "success", throwAfterBurn = false } = {}) {
  const handlers = [];
  const kit = {
    on: (event, handler) => {
      handlers.push({ event, handler });
    },
    estimateBridge: async (params) => ({
      token: "USDC",
      amount: params.amount,
      source: { address: SOURCE, chain: "Ethereum_Sepolia" },
      destination: { address: DESTINATION, chain: "Arc_Testnet" },
      gasFees: [
        {
          name: "Burn gas",
          token: "ETH",
          blockchain: "Ethereum Sepolia",
          fees: { fee: "100000000000000" }
        }
      ],
      fees: [{ type: "provider", token: "USDC", amount: "0.01" }]
    }),
    bridge: async (params) => {
      handlers.forEach(({ handler }) => {
        handler({ method: "bridge.burn", values: { state: "success", txHash: BURN_HASH } });
      });

      if (throwAfterBurn) {
        throw new Error("Bridge failed with Authorization bearer token abc123");
      }

      handlers.forEach(({ handler }) => {
        handler({ method: "bridge.mint", values: { state: bridgeState, txHash: MINT_HASH } });
      });

      return {
        amount: params.amount,
        token: "USDC",
        state: bridgeState,
        provider: "cctp-v2",
        source: { address: SOURCE, chain: "Ethereum_Sepolia" },
        destination: { address: DESTINATION, chain: "Arc_Testnet" },
        steps: [
          { name: "Burn", state: "success", txHash: BURN_HASH },
          { name: "Mint", state: bridgeState, txHash: MINT_HASH }
        ]
      };
    }
  };

  return {
    createAppKit: () => kit,
    createCircleAppKitAdapter: () => ({ adapter: "circle-wallets" })
  };
}

test("estimates Ethereum Sepolia to Arc Testnet USDC bridge fees", async () => {
  const service = createSmartRequestBridgeService(createMockContext());
  const quote = await service.estimateSmartRequestBridge({
    sourceAddress: SOURCE,
    destinationAddress: DESTINATION,
    amount: "12.50",
    token: "USDC"
  });

  assert.equal(quote.sourceChain, "Ethereum_Sepolia");
  assert.equal(quote.destinationChain, "Arc_Testnet");
  assert.equal(quote.token, "USDC");
  assert.equal(quote.sourceAmount, "12.50");
  assert.equal(quote.expectedReceivedAmount, "12.49");
  assert.equal(quote.fees[0].amount, "0.01");
  assert.equal(quote.gasFees[0].token, "ETH");
});

test("executes bridge and normalizes App Kit events and explorer links", async () => {
  const service = createSmartRequestBridgeService(createMockContext());
  const result = await service.executeSmartRequestBridge({
    id: "bridge-1",
    sourceAddress: SOURCE,
    destinationAddress: DESTINATION,
    amount: "10",
    token: "USDC"
  });

  assert.equal(result.id, "bridge-1");
  assert.equal(result.status, "success");
  assert.equal(result.steps.length, 2);
  assert.equal(result.steps[0].txHash, BURN_HASH);
  assert.match(result.steps[0].explorerUrl, /sepolia\.etherscan\.io/);
  assert.equal(result.steps[1].txHash, MINT_HASH);
  assert.match(result.steps[1].explorerUrl, /testnet\.arcscan\.app/);
  assert.equal(result.events.length, 2);
});

test("preserves emitted bridge transaction events when App Kit throws", async () => {
  const service = createSmartRequestBridgeService(createMockContext({ throwAfterBurn: true }));
  const result = await service.executeSmartRequestBridge({
    id: "bridge-recovery",
    sourceAddress: SOURCE,
    destinationAddress: DESTINATION,
    amount: "10",
    token: "USDC"
  });

  assert.equal(result.id, "bridge-recovery");
  assert.equal(result.status, "error");
  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].txHash, BURN_HASH);
  assert.equal(result.error.message, "Bridge operation failed.");
});

test("keeps failed bridge results recoverable and rejects non-USDC tokens", async () => {
  const service = createSmartRequestBridgeService(createMockContext({ bridgeState: "error" }));
  const result = await service.executeSmartRequestBridge({
    sourceAddress: SOURCE,
    destinationAddress: DESTINATION,
    amount: "10",
    token: "USDC"
  });

  assert.equal(result.status, "error");
  assert.equal(result.steps[1].status, "error");
  await assert.rejects(
    () => service.estimateSmartRequestBridge({
      sourceAddress: SOURCE,
      destinationAddress: DESTINATION,
      amount: "10",
      token: "EURC"
    }),
    /USDC only/
  );
});
