const BRAND = {
  appUrl: "https://useveloxpay.xyz",
  supportEmail: "support@useveloxpay.xyz",
  blue: "#2563EB",
  blueDark: "#1D4ED8",
  heading: "#0F172A",
  body: "#475569",
  muted: "#64748B",
  border: "#E2E8F0",
  panel: "#F8FAFC"
};

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function paragraph(copy) {
  return `<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:${BRAND.body};">${copy}</p>`;
}

function emailLayout({ preview = "", title = "", children = "" }) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <title>${escapeHtml(title || "VeloxPay")}</title>
  </head>
  <body style="margin:0;background:#ffffff;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:${BRAND.heading};">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preview)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
            <tr>
              <td style="padding:0 0 20px;">
                ${emailHeader()}
              </td>
            </tr>
            <tr>
              <td style="border:1px solid ${BRAND.border};border-radius:24px;background:#ffffff;padding:28px;box-shadow:0 14px 45px rgba(15,23,42,0.05);">
                ${children}
              </td>
            </tr>
            <tr>
              <td style="padding:22px 4px 0;">
                ${emailFooter()}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function emailHeader() {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="vertical-align:middle;">
          <div style="font-size:18px;font-weight:800;letter-spacing:-0.02em;color:${BRAND.heading};">VeloxPay</div>
          <div style="margin-top:4px;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${BRAND.blue};">Stablecoin payment infrastructure</div>
        </td>
      </tr>
    </table>`;
}

function emailFooter() {
  return `
    <div style="font-size:12px;line-height:1.7;color:${BRAND.muted};">
      <div style="font-weight:700;color:${BRAND.heading};">VeloxPay</div>
      <div><a href="${BRAND.appUrl}" style="color:${BRAND.blue};text-decoration:none;">${BRAND.appUrl}</a></div>
      <div>Support: <a href="mailto:${BRAND.supportEmail}" style="color:${BRAND.blue};text-decoration:none;">${BRAND.supportEmail}</a></div>
    </div>`;
}

function button({ href, label }) {
  if (!href) {
    return "";
  }

  return `<a href="${escapeHtml(href)}" style="display:inline-block;border-radius:12px;background:${BRAND.blue};padding:12px 16px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;">${escapeHtml(label)}</a>`;
}

function detailRows(rows) {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${BRAND.border};border-radius:18px;background:${BRAND.panel};overflow:hidden;">
      ${rows.map(([label, value]) => `
        <tr>
          <td style="padding:13px 16px;border-bottom:1px solid ${BRAND.border};font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${BRAND.muted};width:36%;">${escapeHtml(label)}</td>
          <td style="padding:13px 16px;border-bottom:1px solid ${BRAND.border};font-size:14px;font-weight:700;color:${BRAND.heading};word-break:break-word;">${escapeHtml(value || "-")}</td>
        </tr>
      `).join("")}
    </table>`;
}

function otpEmail({ code, expiresInMinutes = 10, headline = "Welcome to VeloxPay", intro = "Verify your account securely." }) {
  const safeCode = escapeHtml(code);

  return {
    subject: "Your VeloxPay verification code",
    html: emailLayout({
      title: "Your VeloxPay verification code",
      preview: `Your VeloxPay verification code is ${safeCode}.`,
      children: `
        <h1 style="margin:0 0 10px;font-size:26px;line-height:1.2;letter-spacing:-0.02em;color:${BRAND.heading};">${escapeHtml(headline)}</h1>
        ${paragraph(escapeHtml(intro))}
        <div style="margin:24px 0;border:1px solid #BFDBFE;border-radius:20px;background:#EFF6FF;padding:22px;text-align:center;">
          <div style="font-size:12px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;color:${BRAND.blueDark};">Verification code</div>
          <div style="margin-top:10px;font-size:38px;line-height:1;font-weight:800;letter-spacing:0.22em;color:${BRAND.blueDark};">${safeCode}</div>
        </div>
        ${paragraph(`This code expires in ${escapeHtml(expiresInMinutes)} minutes.`)}
        <div style="margin:22px 0;border-radius:18px;background:${BRAND.panel};padding:18px;border:1px solid ${BRAND.border};">
          <div style="font-size:14px;font-weight:800;color:${BRAND.heading};margin-bottom:10px;">You can use VeloxPay to:</div>
          <div style="font-size:14px;line-height:1.8;color:${BRAND.body};">
            <div>✓ Send stablecoins</div>
            <div>✓ Receive payments</div>
            <div>✓ Create payment requests</div>
            <div>✓ Manage programmable payments</div>
          </div>
        </div>
        ${paragraph("If you did not request this code, you can safely ignore this email.")}
        <p style="margin:0;font-size:14px;line-height:1.6;color:${BRAND.body};">VeloxPay Team<br><a href="mailto:${BRAND.supportEmail}" style="color:${BRAND.blue};text-decoration:none;">${BRAND.supportEmail}</a></p>
      `
    })
  };
}

function paymentReceiptEmail({ payment }) {
  const amount = `${payment.amount || "0"} ${payment.currency || ""}`.trim();

  return {
    subject: "Your VeloxPay payment receipt",
    html: emailLayout({
      title: "Your VeloxPay payment receipt",
      preview: `Payment completed successfully: ${amount}.`,
      children: `
        <div style="text-align:center;">
          <div style="display:inline-block;border-radius:999px;background:#ECFDF5;color:#047857;padding:6px 12px;font-size:12px;font-weight:800;">Payment successful</div>
          <h1 style="margin:18px 0 4px;font-size:34px;line-height:1.1;letter-spacing:-0.03em;color:${BRAND.heading};">${escapeHtml(amount)}</h1>
          ${paragraph("Payment completed successfully. Your receipt is ready.")}
        </div>
        ${detailRows([
          ["Status", "Completed"],
          ["Payment ID", payment.id],
          ["From", payment.payerEmail || payment.customerName || "Payer"],
          ["To", payment.ownerEmail || payment.linkLabel || "Recipient"],
          ["Network", "Arc"],
          ["Asset", payment.currency],
          ["Transaction hash", payment.transactionHash]
        ])}
        <div style="margin-top:22px;">
          ${button({ href: payment.explorerUrl, label: "View on Arc Explorer" })}
          <span style="display:inline-block;width:10px;"></span>
          ${button({ href: payment.receiptUrl, label: "View receipt" })}
        </div>
      `
    })
  };
}

function paymentNotificationEmail({ payment }) {
  const amount = `${payment.amount || "0"} ${payment.currency || ""}`.trim();

  return {
    subject: "You received a payment on VeloxPay",
    html: emailLayout({
      title: "You received a payment on VeloxPay",
      preview: `You received ${amount} on VeloxPay.`,
      children: `
        <h1 style="margin:0 0 10px;font-size:26px;line-height:1.2;letter-spacing:-0.02em;color:${BRAND.heading};">You received a payment on VeloxPay</h1>
        ${paragraph("You have received a stablecoin payment.")}
        <div style="margin:22px 0;border-radius:20px;background:#EFF6FF;border:1px solid #BFDBFE;padding:22px;text-align:center;">
          <div style="font-size:12px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;color:${BRAND.blueDark};">Amount received</div>
          <div style="margin-top:8px;font-size:32px;line-height:1.1;font-weight:800;color:${BRAND.blueDark};">${escapeHtml(amount)}</div>
        </div>
        ${detailRows([
          ["Currency", payment.currency],
          ["Sender", payment.payerEmail || payment.customerName || "Payer"],
          ["Payment request", payment.linkLabel || payment.linkId],
          ["Payment ID", payment.id]
        ])}
        <div style="margin-top:22px;">
          ${button({ href: payment.receiptUrl, label: "View receipt" })}
        </div>
      `
    })
  };
}

module.exports = {
  BRAND,
  emailFooter,
  emailHeader,
  emailLayout,
  otpEmail,
  paymentNotificationEmail,
  paymentReceiptEmail
};
