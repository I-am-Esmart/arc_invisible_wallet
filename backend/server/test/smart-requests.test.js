const assert = require("node:assert/strict");
const test = require("node:test");
const {
  buildSmartRequestFromPaymentLink,
  calculateRecipientAmounts,
  canonicalJson,
  createSmartRequestRepository,
  hashCanonicalJson,
  normalizeSmartRequest,
  parseTokenAmountToBaseUnits,
  serializeSmartRequest,
  smartRequestExternalKey,
  smartRequestKey,
  smartRequestOnchainKey,
  smartRequestPaymentLinkKey,
  smartRequestsCreatorKey
} = require("../smart-requests");

const OWNER = "0x1111111111111111111111111111111111111111";
const PAYER = "0x2222222222222222222222222222222222222222";
const RECIPIENT_A = "0x3333333333333333333333333333333333333333";
const RECIPIENT_B = "0x4444444444444444444444444444444444444444";
const TOKEN = "0x3600000000000000000000000000000000000000";
const CONTRACT = "0x5555555555555555555555555555555555555555";
const NOW = "2026-07-20T12:00:00.000Z";
const DUE = "2026-08-20T12:00:00.000Z";

function baseInput(overrides = {}) {
  return {
    id: "smart-request-1",
    paymentLinkId: "link-1",
    onchainRequestId: "42",
    contractAddress: CONTRACT,
    chain: "ARC-TESTNET",
    mode: "split",
    currency: "USDC",
    tokenAddress: TOKEN,
    amount: "100.25",
    creatorUserId: "creator@example.com",
    creatorWalletId: "wallet-creator",
    creatorWalletAddress: OWNER,
    expectedPayerEmail: "payer@example.com",
    actualPayerWalletId: "wallet-payer",
    actualPayerWalletAddress: PAYER,
    recipients: [
      {
        name: "Alice",
        role: "merchant",
        email: "alice@example.com",
        walletAddress: RECIPIENT_A,
        allocationBps: 6_000
      },
      {
        name: "Bob",
        role: "fulfillment",
        email: "bob@example.com",
        walletAddress: RECIPIENT_B,
        allocationBps: 4_000
      }
    ],
    description: "Installment delivery",
    dueDate: DUE,
    ...overrides
  };
}

test("validates and normalizes a complete SmartRequest model", () => {
  const smartRequest = normalizeSmartRequest(baseInput(), { now: NOW });

  assert.equal(smartRequest.id, "smart-request-1");
  assert.equal(smartRequest.paymentLinkId, "link-1");
  assert.match(smartRequest.externalPaymentId, /^0x[a-f0-9]{64}$/);
  assert.equal(smartRequest.contractAddress, CONTRACT);
  assert.equal(smartRequest.chain, "ARC-TESTNET");
  assert.equal(smartRequest.mode, "split");
  assert.equal(smartRequest.currency, "USDC");
  assert.equal(smartRequest.amount, "100.25");
  assert.equal(smartRequest.amountBaseUnits, "100250000");
  assert.equal(smartRequest.creatorUserId, "creator@example.com");
  assert.equal(smartRequest.creatorWalletId, "wallet-creator");
  assert.equal(smartRequest.creatorWalletAddress, OWNER);
  assert.equal(smartRequest.expectedPayerEmail, "payer@example.com");
  assert.equal(smartRequest.actualPayerWalletId, "wallet-payer");
  assert.equal(smartRequest.actualPayerWalletAddress, PAYER);
  assert.equal(smartRequest.recipients[0].amountBaseUnits, "60150000");
  assert.equal(smartRequest.recipients[0].amount, "60.15");
  assert.equal(smartRequest.recipients[1].amountBaseUnits, "40100000");
  assert.equal(smartRequest.recipients[1].amount, "40.1");
  assert.equal(smartRequest.metadataHash.length, 66);
  assert.equal(smartRequest.offchainStatus, "open");
  assert.equal(smartRequest.onchainStatus, "not_created");
  assert.equal(smartRequest.createdAt, NOW);
  assert.equal(smartRequest.updatedAt, NOW);
});

test("uses integer-safe token conversion and rejects unsafe decimal input", () => {
  assert.equal(parseTokenAmountToBaseUnits("0.000001", 6), "1");
  assert.equal(parseTokenAmountToBaseUnits("123456789.123456", 6), "123456789123456");
  assert.throws(() => parseTokenAmountToBaseUnits("1.0000001", 6), /at most 6 decimal places/);
  assert.throws(() => parseTokenAmountToBaseUnits("1e3", 6), /positive decimal string/);
  assert.throws(() => parseTokenAmountToBaseUnits("0", 6), /greater than zero/);
});

test("canonical JSON and metadata hash are stable independent of object key order", () => {
  const left = {
    b: "two",
    a: {
      z: 3,
      y: [2, { d: "four", c: "three" }]
    }
  };
  const right = {
    a: {
      y: [2, { c: "three", d: "four" }],
      z: 3
    },
    b: "two"
  };

  assert.equal(canonicalJson(left), canonicalJson(right));
  assert.equal(hashCanonicalJson(left), hashCanonicalJson(right));
  assert.match(hashCanonicalJson(left), /^0x[a-f0-9]{64}$/);
});

test("rejects recipient counts over ten and allocation totals not equal to 10,000", () => {
  const tooManyRecipients = Array.from({ length: 11 }, (_, index) => ({
    name: `Recipient ${index}`,
    role: "split",
    email: `r${index}@example.com`,
    walletAddress: RECIPIENT_A,
    allocationBps: index === 10 ? 0 : 1_000
  }));

  assert.throws(() => normalizeSmartRequest(baseInput({ recipients: tooManyRecipients }), { now: NOW }), /between 1 and 10/);
  assert.throws(
    () =>
      normalizeSmartRequest(
        baseInput({
          recipients: [
            { walletAddress: RECIPIENT_A, allocationBps: 5_000 },
            { walletAddress: RECIPIENT_B, allocationBps: 4_999 }
          ]
        }),
        { now: NOW }
      ),
    /total exactly 10,000/
  );
});

test("rejects invalid wallet addresses, payment modes, and mismatched base-unit amounts", () => {
  assert.throws(() => normalizeSmartRequest(baseInput({ tokenAddress: "0x123" }), { now: NOW }), /Token address/);
  assert.throws(() => normalizeSmartRequest(baseInput({ mode: "escrow" }), { now: NOW }), /Payment mode/);
  assert.throws(
    () => normalizeSmartRequest(baseInput({ amount: "1", amountBaseUnits: "1000001" }), { now: NOW }),
    /do not match/
  );
});

test("calculates split recipient amounts using the final recipient remainder", () => {
  const recipients = calculateRecipientAmounts(
    [
      { name: "A", role: "", email: "", walletAddress: RECIPIENT_A, allocationBps: 3333 },
      { name: "B", role: "", email: "", walletAddress: RECIPIENT_B, allocationBps: 6667 }
    ],
    "100",
    6
  );

  assert.equal(recipients[0].amountBaseUnits, "33");
  assert.equal(recipients[1].amountBaseUnits, "67");
});

test("serializes and deserializes as validated plain JSON", () => {
  const smartRequest = normalizeSmartRequest(baseInput(), { now: NOW });
  const serialized = serializeSmartRequest(smartRequest);
  const roundTrip = serializeSmartRequest(JSON.parse(JSON.stringify(serialized)));

  assert.deepEqual(roundTrip, serialized);
});

test("repository saves locally and through persistent JSON helpers without direct Redis use", async () => {
  const persisted = new Map();
  const store = { smartRequests: [] };
  const repository = createSmartRequestRepository({
    store,
    getPersistentJson: async (key) => persisted.get(key) || null,
    setPersistentJson: async (key, value) => {
      persisted.set(key, value);
    }
  });
  const smartRequest = await repository.save(normalizeSmartRequest(baseInput(), { now: NOW }));

  assert.equal(store.smartRequests.length, 1);
  assert.deepEqual(await repository.getById(smartRequest.id), smartRequest);
  assert.deepEqual(await repository.getByExternalPaymentId(smartRequest.externalPaymentId), smartRequest);
  assert.deepEqual(
    await repository.getByOnchainRequest({
      chain: smartRequest.chain,
      contractAddress: smartRequest.contractAddress,
      onchainRequestId: smartRequest.onchainRequestId
    }),
    smartRequest
  );
  assert.deepEqual(await repository.getByPaymentLinkId("link-1"), smartRequest);
  assert.deepEqual(await repository.listByCreatorUserId("creator@example.com"), [smartRequest]);
  assert.deepEqual(persisted.get(smartRequestKey(smartRequest.id)), smartRequest);
  assert.equal(persisted.get(smartRequestExternalKey(smartRequest.externalPaymentId)), smartRequest.id);
  assert.equal(
    persisted.get(smartRequestOnchainKey(smartRequest.chain, smartRequest.contractAddress, smartRequest.onchainRequestId)),
    smartRequest.id
  );
  assert.equal(persisted.get(smartRequestPaymentLinkKey("link-1")), smartRequest.id);
  assert.deepEqual(persisted.get(smartRequestsCreatorKey("creator@example.com")), [smartRequest]);
});

test("builds a backward-compatible SmartRequest from an existing payment link", () => {
  const smartRequest = buildSmartRequestFromPaymentLink(
    {
      id: "legacy-link-id",
      linkCode: "legacy-code",
      currency: "USDC",
      amount: "12.50",
      ownerEmail: "owner@example.com",
      ownerName: "Owner",
      username: "owner",
      recipientAddress: RECIPIENT_A,
      customerEmail: "payer@example.com",
      description: "Legacy link"
    },
    {
      id: "smart-from-link",
      creatorWalletId: "wallet-owner",
      tokenAddress: TOKEN,
      contractAddress: CONTRACT,
      mode: "standard",
      dueDate: DUE
    }
  );

  assert.equal(smartRequest.paymentLinkId, "legacy-link-id");
  assert.equal(smartRequest.mode, "standard");
  assert.equal(smartRequest.amountBaseUnits, "12500000");
  assert.equal(smartRequest.recipients.length, 1);
  assert.equal(smartRequest.recipients[0].amount, "12.5");
});
