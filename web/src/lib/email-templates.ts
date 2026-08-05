export type EmailContent = {
  subject: string;
  text: string;
  html: string;
};

const BRAND = "Ballot Access Pros";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function wrapBrandedEmail(input: {
  preview: string;
  heading: string;
  bodyHtml: string;
  bodyText: string;
  ctaLabel?: string;
  ctaUrl?: string;
  subject: string;
}): EmailContent {
  const heading = escapeHtml(input.heading);
  const preview = escapeHtml(input.preview);
  const cta =
    input.ctaLabel && input.ctaUrl
      ? `<p style="margin:28px 0 8px"><a href="${escapeHtml(input.ctaUrl)}" style="display:inline-block;background:#1e2a45;color:#faf6ee;text-decoration:none;padding:12px 20px;border-radius:6px;font-weight:600">${escapeHtml(input.ctaLabel)}</a></p>
<p style="margin:0;font-size:12px;color:#666;word-break:break-all">${escapeHtml(input.ctaUrl)}</p>`
      : "";
  const textCta =
    input.ctaLabel && input.ctaUrl
      ? `\n\n${input.ctaLabel}:\n${input.ctaUrl}\n`
      : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(input.subject)}</title></head>
<body style="margin:0;padding:0;background:#f3eee4;font-family:Georgia,'Times New Roman',serif;color:#111114">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">${preview}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3eee4;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border:1px solid #e4dccb;border-radius:10px;overflow:hidden">
        <tr><td style="background:#1e2a45;padding:20px 28px">
          <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#c6a15b">${escapeHtml(BRAND)}</p>
        </td></tr>
        <tr><td style="padding:28px">
          <h1 style="margin:0 0 16px;font-size:24px;line-height:1.3;font-weight:600">${heading}</h1>
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#222">${input.bodyHtml}</div>
          ${cta}
        </td></tr>
        <tr><td style="padding:16px 28px 24px;border-top:1px solid #eee;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#777">
          ${escapeHtml(BRAND)} · Payroll &amp; field operations
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = `${BRAND}

${input.heading}

${input.bodyText}${textCta}
— ${BRAND}`;

  return { subject: input.subject, text, html };
}

export function inviteEmailContent(firstName: string, actionLink: string): EmailContent {
  const name = firstName.trim() || "there";
  return wrapBrandedEmail({
    subject: `${BRAND}: set your password`,
    preview: "Your account is ready. Set your password to sign in.",
    heading: "Your account is ready",
    bodyHtml: `<p style="margin:0 0 12px">Hi ${escapeHtml(name)},</p><p style="margin:0">Your ${escapeHtml(BRAND)} payroll account is ready. Use the button below to set your password and sign in.</p><p style="margin:16px 0 0;color:#555">If you did not expect this email, you can ignore it.</p>`,
    bodyText: `Hi ${name},\n\nYour ${BRAND} payroll account is ready. Set your password and sign in with the link below.\n\nIf you did not expect this email, you can ignore it.`,
    ctaLabel: "Set password & sign in",
    ctaUrl: actionLink,
  });
}

export function passwordResetEmailContent(actionLink: string): EmailContent {
  return wrapBrandedEmail({
    subject: `${BRAND}: reset your password`,
    preview: "Use this link to reset your password.",
    heading: "Reset your password",
    bodyHtml: `<p style="margin:0 0 12px">We received a request to reset your ${escapeHtml(BRAND)} password.</p><p style="margin:0">Use the button below to choose a new password. This link expires for security.</p><p style="margin:16px 0 0;color:#555">If you did not request this, you can ignore this email.</p>`,
    bodyText: `We received a request to reset your ${BRAND} password.\n\nUse the link below to choose a new password. This link expires for security.\n\nIf you did not request this, you can ignore this email.`,
    ctaLabel: "Reset password",
    ctaUrl: actionLink,
  });
}

export function checkoutReminderEmailContent(input: {
  firstName: string;
  propertyName: string;
  roomNumber: string;
}): EmailContent {
  const name = input.firstName.trim() || "there";
  const property = input.propertyName.trim() || "your lodging";
  const room = input.roomNumber.trim() || "—";
  return wrapBrandedEmail({
    subject: `${BRAND}: checkout reminder — ${property}`,
    preview: `Please confirm checkout for ${property}.`,
    heading: "Checkout reminder",
    bodyHtml: `<p style="margin:0 0 12px">Hi ${escapeHtml(name)},</p><p style="margin:0">Please confirm checkout for <strong>${escapeHtml(property)}</strong> (room ${escapeHtml(room)}) in Field Operations if you have already checked out.</p>`,
    bodyText: `Hi ${name},\n\nPlease confirm checkout for ${property} (room ${room}) in Field Operations if you have already checked out.`,
  });
}

export function mailEnvStatus() {
  return {
    resendKey: Boolean(process.env.RESEND_API_KEY?.trim()),
    emailFrom: Boolean(process.env.EMAIL_FROM?.trim()),
    siteUrl: Boolean(
      process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
        process.env.SITE_URL?.trim() ||
        process.env.NEXT_PUBLIC_VERCEL_URL?.trim(),
    ),
    configured: Boolean(process.env.RESEND_API_KEY?.trim() && process.env.EMAIL_FROM?.trim()),
  };
}
