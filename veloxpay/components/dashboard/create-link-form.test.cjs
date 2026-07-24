const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const ts = require("typescript");

const componentPath = path.join(__dirname, "create-link-form.tsx");

function calculateMockAllocations({ amount = "0", currency = "USDC", recipients = [] }) {
  const totalBps = recipients.reduce((sum, recipient) => {
    const [whole = "0", fraction = ""] = String(recipient.percentage || "0").split(".");
    return sum + Number(whole || "0") * 100 + Number((fraction + "00").slice(0, 2));
  }, 0);

  return {
    totalBps,
    totalPercentage: String(totalBps / 100),
    isFullyAllocated: totalBps === 10000,
    recipients: recipients.map((recipient) => ({
      ...recipient,
      allocationBps: 0,
      amount: amount || "0",
      amountBaseUnits: "0",
      currency,
    })),
  };
}

function loadCreateLinkForm() {
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
    if (id === "react" || id === "react/jsx-runtime") {
      return require(id);
    }

    if (id === "next/navigation") {
      return { useRouter: () => ({ refresh() {} }) };
    }

    if (id === "@/lib/api/payment-links") {
      return { createPaymentLink: async () => ({}) };
    }

    if (id === "@/lib/api/features") {
      return {
        fetchFeatureCapabilities: async () => ({
          payments: { smartRequests: true, smartRequestsMessage: "" },
        }),
      };
    }

    if (id === "@/lib/api/smart-requests") {
      return { createSmartRequest: async () => ({}) };
    }

    if (id === "@/lib/smart-requests/validation") {
      return {
        SMART_REQUEST_MAX_RECIPIENTS: 10,
        calculateSmartRequestRecipients: calculateMockAllocations,
        validateSmartRequestDraft: calculateMockAllocations,
      };
    }

    if (id === "@/components/ui/button") {
      return {
        Button: ({ children, type = "button", disabled, onClick }) =>
          React.createElement("button", { type, disabled, onClick }, children),
      };
    }

    if (id === "@/components/ui/card") {
      return {
        Card: ({ children }) => React.createElement("div", null, children),
      };
    }

    if (id === "@/components/ui/field") {
      return {
        Field: ({ label, hint, children }) =>
          React.createElement("label", null, [
            React.createElement("span", { key: "label" }, label),
            children,
            hint ? React.createElement("span", { key: "hint" }, hint) : null,
          ]),
      };
    }

    if (id === "@/lib/session/payment-links") {
      return { upsertStoredPaymentLink() {} };
    }

    throw new Error(`Unexpected import in CreateLinkForm test: ${id}`);
  };

  vm.runInNewContext(output, {
    console,
    crypto: { randomUUID: () => "00000000-0000-4000-8000-000000000000" },
    exports: module.exports,
    module,
    require: localRequire,
  });

  return module.exports.CreateLinkForm;
}

test("CreateLinkForm renders Smart Request payment type controls without dropping standard link fields", () => {
  const CreateLinkForm = loadCreateLinkForm();
  const html = renderToStaticMarkup(
    React.createElement(CreateLinkForm, {
      walletUser: {
        email: "creator@example.com",
        address: "0x1111111111111111111111111111111111111111",
        arcKeyId: "wallet-id",
        displayName: "Creator",
        sessionToken: "session-token",
      },
      customers: [
        {
          ownerEmail: "creator@example.com",
          email: "client@example.com",
          name: "Client",
        },
      ],
    }),
  );

  assert.match(html, /Standard/);
  assert.match(html, /Split Payment/);
  assert.match(html, /Protected Payment/);
  assert.match(html, /Recent customers/);
  assert.match(html, /Amount/);
  assert.match(html, /USDC on Arc/);
  assert.match(html, /Billing cadence/);
});

test("CreateLinkForm source keeps Smart Request review, allocation, and protected-payment controls", () => {
  const source = fs.readFileSync(componentPath, "utf8");

  assert.match(source, /createSmartRequest/);
  assert.match(source, /createPaymentLink/);
  assert.match(source, /allocationTotal}% allocated/);
  assert.match(source, /Add recipient/);
  assert.match(source, /Completion deadline/);
  assert.match(source, /Refund eligibility date/);
  assert.match(source, /Estimated network fee/);
  assert.match(source, /held by the Arc smart contract/);
  assert.match(source, /distributed by the Arc smart contract/);
});
