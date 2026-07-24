const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const ts = require("typescript");

const componentPath = path.join(__dirname, "payment-link-card.tsx");
const checkoutPath = path.join(__dirname, "smart-request-checkout.tsx");

function loadPaymentLinkCard() {
  const source = fs.readFileSync(componentPath, "utf8");
  const output = ts.transpileModule(source, {
    fileName: componentPath,
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  const module = { exports: {} };
  const localRequire = (id) => {
    if (id === "react/jsx-runtime") {
      return require(id);
    }

    if (id === "@/components/ui/card") {
      return {
        Card: ({ children }) => React.createElement("div", null, children),
      };
    }

    if (id === "@/components/ui/badge") {
      return {
        Badge: ({ children }) => React.createElement("span", null, children),
      };
    }

    if (id === "./pay-button") {
      return {
        PayButton: () => React.createElement("div", null, "Legacy pay button"),
      };
    }

    if (id === "./smart-request-checkout") {
      return {
        SmartRequestCheckout: () => React.createElement("div", null, "Smart Request checkout"),
      };
    }

    if (id === "@/lib/utils/format") {
      return {
        formatMoney: (amount, currency) => `${amount} ${currency}`,
      };
    }

    throw new Error(`Unexpected import in PaymentLinkCard test: ${id}`);
  };

  vm.runInNewContext(output, {
    console,
    exports: module.exports,
    module,
    require: localRequire,
  });

  return module.exports.PaymentLinkCard;
}

function paymentLink(overrides = {}) {
  return {
    id: "link-1",
    linkCode: "abc123",
    linkToken: "token",
    username: "creator",
    ownerName: "Creator",
    ownerEmail: "creator@example.com",
    amount: "100",
    currency: "USDC",
    status: "active",
    ...overrides,
  };
}

function smartRequest(mode, recipients) {
  return {
    id: `smart-${mode}`,
    paymentLinkId: "link-1",
    onchainRequestId: "1",
    externalPaymentId: "0x".padEnd(66, "1"),
    contractAddress: "0x1111111111111111111111111111111111111111",
    chain: "ARC-TESTNET",
    mode,
    currency: "USDC",
    tokenAddress: "0x3600000000000000000000000000000000000000",
    amount: "100",
    amountBaseUnits: "100000000",
    creatorUserId: "creator@example.com",
    creatorWalletId: "wallet-creator",
    creatorWalletAddress: "0x2222222222222222222222222222222222222222",
    expectedPayerEmail: "",
    recipients,
    description: "Milestone payment",
    dueDate: "2026-08-01T00:00:00.000Z",
    refundEligibilityDate: "2026-08-02T00:00:00.000Z",
    metadataHash: "0x".padEnd(66, "2"),
    deliverableUrl: "",
    offchainStatus: "open",
    onchainStatus: "open",
    createdAt: "2026-07-21T00:00:00.000Z",
    updatedAt: "2026-07-21T00:00:00.000Z",
  };
}

test("standard payment links keep the legacy payment flow", () => {
  const PaymentLinkCard = loadPaymentLinkCard();
  const html = renderToStaticMarkup(
    React.createElement(PaymentLinkCard, {
      paymentLink: paymentLink(),
      payAction: async () => ({}),
    }),
  );

  assert.match(html, /Standard/);
  assert.match(html, /Legacy pay button/);
  assert.doesNotMatch(html, /Smart Request checkout/);
});

test("split Smart Requests show every recipient and allocation before verification", () => {
  const PaymentLinkCard = loadPaymentLinkCard();
  const request = smartRequest("split", [
    {
      name: "Designer",
      role: "design",
      email: "designer@example.com",
      walletAddress: "0x3333333333333333333333333333333333333333",
      allocationBps: 6000,
      amount: "60",
      amountBaseUnits: "60000000",
    },
    {
      name: "Developer",
      role: "build",
      email: "dev@example.com",
      walletAddress: "0x4444444444444444444444444444444444444444",
      allocationBps: 4000,
      amount: "40",
      amountBaseUnits: "40000000",
    },
  ]);
  const html = renderToStaticMarkup(
    React.createElement(PaymentLinkCard, {
      paymentLink: paymentLink({ paymentMode: "split" }),
      payAction: async () => ({}),
      smartRequest: request,
    }),
  );

  assert.match(html, /Split Payment/);
  assert.match(html, /Payment breakdown/);
  assert.match(html, /Designer/);
  assert.match(html, /60% - 60 USDC/);
  assert.match(html, /Developer/);
  assert.match(html, /40% - 40 USDC/);
  assert.match(html, /Smart Request checkout/);
});

test("protected Smart Requests prominently state contract custody before verification", () => {
  const PaymentLinkCard = loadPaymentLinkCard();
  const request = smartRequest("protected", [
    {
      name: "Merchant",
      role: "delivery",
      email: "merchant@example.com",
      walletAddress: "0x5555555555555555555555555555555555555555",
      allocationBps: 10000,
      amount: "100",
      amountBaseUnits: "100000000",
    },
  ]);
  const html = renderToStaticMarkup(
    React.createElement(PaymentLinkCard, {
      paymentLink: paymentLink({ paymentMode: "protected" }),
      payAction: async () => ({}),
      smartRequest: request,
    }),
  );

  assert.match(html, /Protected Payment/);
  assert.match(html, /contract will hold these funds until the payer approves release/);
});

test("Smart Request checkout source covers failure and refresh recovery states", () => {
  const source = fs.readFileSync(checkoutPath, "utf8");

  assert.match(source, /checking_balance/);
  assert.match(source, /approving_token/);
  assert.match(source, /submitting_payment/);
  assert.match(source, /confirming_arc/);
  assert.match(source, /verifying_onchain/);
  assert.match(source, /resumeSmartRequestPayment/);
  assert.match(source, /readPersistedState/);
  assert.match(source, /setRecoverableError/);
  assert.match(source, /Insufficient|checkSmartRequestBalance/);
  assert.match(source, /approveSmartRequestToken/);
  assert.match(source, /paySmartRequest/);
  assert.match(source, /gasSponsorship\?\.confirmed/);
  assert.match(source, /Network fee sponsored by VeloxPay/);
  assert.match(source, /quoteSmartRequestBridge/);
  assert.match(source, /executeSmartRequestBridge/);
  assert.match(source, /resumeSmartRequestBridge/);
  assert.match(source, /SHOW_PRIMARY_BRIDGE_FLOW = false/);
  assert.match(source, /Bridge stage/);
  assert.match(source, /confirming_arc_balance/);
});
