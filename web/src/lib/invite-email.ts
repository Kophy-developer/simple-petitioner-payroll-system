import type { SupabaseClient } from "@supabase/supabase-js";

export type InviteEmailResult = {
  emailed: boolean;
  provider: "resend" | "supabase_smtp" | "none";
  message?: string;
  actionLink?: string;
};

function siteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    process.env.SITE_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_VERCEL_URL?.replace(/\/$/, "") ||
    ""
  );
}

function redirectTo() {
  const base = siteUrl();
  if (!base) return undefined;
  const withProto = base.startsWith("http") ? base : `https://${base}`;
  return `${withProto}/reset-password`;
}

async function sendViaResend(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) return null;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend failed (${res.status}): ${body}`);
  }
  return "resend" as const;
}

function inviteCopy(firstName: string, actionLink: string) {
  const name = firstName.trim() || "there";
  const subject = "Your Ballot Access Pros payroll login";
  const text = `Hi ${name},

Your Ballot Access Pros account is ready. Set your password and sign in here:
${actionLink}

If you did not expect this email, ignore it.`;
  const html = `<p>Hi ${name},</p><p>Your Ballot Access Pros account is ready. <a href="${actionLink}">Set your password and sign in</a>.</p><p>If you did not expect this email, ignore it.</p>`;
  return { subject, text, html };
}

export function inviteEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export async function sendUserInviteEmail(
  admin: SupabaseClient,
  input: { email: string; firstName: string },
): Promise<InviteEmailResult> {
  const email = input.email.trim().toLowerCase();
  const redirect = redirectTo();

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: redirect ? { redirectTo: redirect } : undefined,
  });

  if (linkError) {
    return {
      emailed: false,
      provider: "none",
      message: linkError.message,
    };
  }

  const actionLink =
    linkData.properties?.action_link ||
    (linkData as { action_link?: string }).action_link ||
    "";

  if (!actionLink) {
    return {
      emailed: false,
      provider: "none",
      message: "Could not generate invite link.",
    };
  }

  const copy = inviteCopy(input.firstName, actionLink);

  try {
    const viaResend = await sendViaResend({
      to: email,
      subject: copy.subject,
      html: copy.html,
      text: copy.text,
    });
    if (viaResend) {
      return { emailed: true, provider: viaResend, actionLink };
    }
  } catch (e) {
    return {
      emailed: false,
      provider: "none",
      message: e instanceof Error ? e.message : "Resend send failed",
      actionLink,
    };
  }

  try {
    const { error } = await admin.auth.resetPasswordForEmail(email, {
      redirectTo: redirect,
    });
    if (error) {
      return {
        emailed: false,
        provider: "none",
        message:
          error.message ||
          "Email not sent. Set RESEND_API_KEY + EMAIL_FROM, or configure Supabase Auth SMTP.",
        actionLink,
      };
    }
    return { emailed: true, provider: "supabase_smtp", actionLink };
  } catch (e) {
    return {
      emailed: false,
      provider: "none",
      message:
        e instanceof Error
          ? e.message
          : "Email not sent. Set RESEND_API_KEY + EMAIL_FROM, or configure Supabase Auth SMTP.",
      actionLink,
    };
  }
}

export const INVITE_ENV_HINT =
  "Requires RESEND_API_KEY + EMAIL_FROM (app mail), or Supabase Auth SMTP (see scripts/apply-resend-smtp-on-droplet.sh). NEXT_PUBLIC_SITE_URL or SITE_URL should point at the app for password-reset links.";
