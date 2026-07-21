const DEFAULT_BACKEND_URL = "http://localhost:4000";

const demoRecipients = [
  {
    envPrefix: "DEMO_DEVELOPER",
    name: "Maya Chen",
    role: "Lead developer",
    email: "developer@northstar.studio",
    walletAddress: "0x1111111111111111111111111111111111111111",
    allocationBps: 6000
  },
  {
    envPrefix: "DEMO_DESIGNER",
    name: "Noah Reed",
    role: "Product designer",
    email: "designer@northstar.studio",
    walletAddress: "0x2222222222222222222222222222222222222222",
    allocationBps: 2000
  },
  {
    envPrefix: "DEMO_PROJECT_MANAGER",
    name: "Ava Brooks",
    role: "Project manager",
    email: "pm@northstar.studio",
    walletAddress: "0x3333333333333333333333333333333333333333",
    allocationBps: 1000
  },
  {
    envPrefix: "DEMO_AGENCY_TREASURY",
    name: "Northstar Studio Treasury",
    role: "Agency treasury",
    email: "treasury@northstar.studio",
    walletAddress: "0x4444444444444444444444444444444444444444",
    allocationBps: 1000
  }
];

function env(name, fallback = "") {
  return String(process.env[name] || fallback).trim();
}

function daysFromNow(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function recipientFromEnv(recipient) {
  return {
    name: env(`${recipient.envPrefix}_NAME`, recipient.name),
    role: env(`${recipient.envPrefix}_ROLE`, recipient.role),
    email: env(`${recipient.envPrefix}_EMAIL`, recipient.email),
    walletAddress: env(`${recipient.envPrefix}_WALLET_ADDRESS`, recipient.walletAddress),
    allocationBps: recipient.allocationBps
  };
}

async function main() {
  const backendUrl = env("DEMO_BACKEND_URL", DEFAULT_BACKEND_URL).replace(/\/$/, "");
  const payload = {
    amount: "1000",
    currency: "USDC",
    paymentMode: "protected",
    ownerEmail: env("DEMO_CREATOR_EMAIL", "agency-owner@northstar.studio"),
    ownerName: env("DEMO_CREATOR_NAME", "Northstar Studio"),
    walletSessionToken: env("DEMO_WALLET_SESSION_TOKEN"),
    customerEmail: env("DEMO_PAYER_EMAIL", "client@example.com"),
    customerName: env("DEMO_PAYER_NAME", "Acme Client"),
    description: "Website development milestone payment for Acme Client",
    deliverableDescription: "website-development deliverable: production-ready marketing website, CMS handoff, and launch checklist",
    dueDate: env("DEMO_DUE_DATE", daysFromNow(14)),
    refundEligibilityDate: env("DEMO_REFUND_ELIGIBILITY_DATE", daysFromNow(21)),
    recipients: demoRecipients.map(recipientFromEnv)
  };

  if (process.argv.includes("--dry-run")) {
    console.log(JSON.stringify({ endpoint: `${backendUrl}/smart-requests`, payload }, null, 2));
    return;
  }

  const response = await fetch(`${backendUrl}/smart-requests`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(payload.walletSessionToken ? { "x-veloxpay-session": payload.walletSessionToken } : {})
    },
    body: JSON.stringify(payload)
  });
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    console.error("Failed to seed agency Smart Request.");
    console.error(JSON.stringify({ status: response.status, body }, null, 2));
    process.exitCode = 1;
    return;
  }

  console.log("Seeded protected agency Smart Request.");
  console.log(JSON.stringify({
    paymentLinkUrl: body.paymentLink?.url,
    smartRequestId: body.smartRequest?.id,
    mode: body.smartRequest?.mode,
    amount: body.smartRequest?.amount,
    currency: body.smartRequest?.currency,
    onchainStatus: body.smartRequest?.onchainStatus,
    contractAddress: body.smartRequest?.contractAddress,
    recipients: body.smartRequest?.recipients?.map((recipient) => ({
      name: recipient.name,
      role: recipient.role,
      allocationBps: recipient.allocationBps,
      amount: recipient.amount,
      walletAddress: recipient.walletAddress
    }))
  }, null, 2));
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exitCode = 1;
});
