import assert from "node:assert/strict";
import test from "node:test";
import {
  bpsToPercentage,
  calculateSmartRequestRecipients,
  parsePercentageToBps,
  parseTokenAmountToBaseUnits,
  validateSmartRequestDraft,
} from "./validation.ts";

const RECIPIENT_A = "0x3333333333333333333333333333333333333333";
const RECIPIENT_B = "0x4444444444444444444444444444444444444444";

test("converts token amounts using integer base units", () => {
  assert.equal(parseTokenAmountToBaseUnits("100.25", 6), "100250000");
  assert.equal(parseTokenAmountToBaseUnits("0.000001", 6), "1");
  assert.throws(() => parseTokenAmountToBaseUnits("1.0000001", 6), /at most 6 decimal places/);
});

test("converts percentages to basis points without floating point math", () => {
  assert.equal(parsePercentageToBps("50"), 5000);
  assert.equal(parsePercentageToBps("33.33"), 3333);
  assert.equal(bpsToPercentage(3333), "33.33");
  assert.throws(() => parsePercentageToBps("33.333"), /at most two decimal places/);
});

test("calculates split recipient amounts and final recipient remainder", () => {
  const result = calculateSmartRequestRecipients({
    amount: "1",
    currency: "USDC",
    recipients: [
      {
        id: "a",
        name: "A",
        role: "merchant",
        email: "a@example.com",
        walletAddress: RECIPIENT_A,
        percentage: "33.33",
      },
      {
        id: "b",
        name: "B",
        role: "fulfillment",
        email: "b@example.com",
        walletAddress: RECIPIENT_B,
        percentage: "66.67",
      },
    ],
  });

  assert.equal(result.totalBps, 10000);
  assert.equal(result.recipients[0].amountBaseUnits, "333300");
  assert.equal(result.recipients[1].amountBaseUnits, "666700");
});

test("validates protected payment deadline, refund date, allocation total, and wallet addresses", () => {
  assert.throws(
    () =>
      validateSmartRequestDraft({
        mode: "protected",
        amount: "10",
        currency: "USDC",
        dueDate: "",
        refundEligibilityDate: "2026-08-20",
        recipients: [
          {
            id: "a",
            name: "A",
            role: "merchant",
            email: "a@example.com",
            walletAddress: RECIPIENT_A,
            percentage: "100",
          },
        ],
      }),
    /completion deadline/,
  );

  assert.throws(
    () =>
      validateSmartRequestDraft({
        mode: "split",
        amount: "10",
        currency: "USDC",
        recipients: [
          {
            id: "a",
            name: "A",
            role: "merchant",
            email: "a@example.com",
            walletAddress: "not-an-address",
            percentage: "100",
          },
        ],
      }),
    /wallet address must be valid/,
  );
});
