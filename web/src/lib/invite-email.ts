import type { SupabaseClient } from "@supabase/supabase-js";
import {
  inviteEmailContent,
  mailEnvStatus,
  passwordResetEmailContent,
  type EmailContent,
} from "@/lib/email-templates";

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

export async function sendViaResend(input: {
  to: string;
  content: EmailContent;
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
      subject: input.content.subject,
      html: input.content.html,
      text: input.content.text,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend failed (${res.status}): ${body}`);
  }
  return "resend" as const;
}

export function inviteEmailConfigured() {
  return mailEnvStatus().configured;
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

  const content = inviteEmailContent(input.firstName, actionLink);

  try {
    const viaResend = await sendViaResend({ to: email, content });
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

export async function sendPasswordResetEmail(
  admin: SupabaseClient,
  emailRaw: string,
): Promise<InviteEmailResult> {
  const email = emailRaw.trim().toLowerCase();
  const redirect = redirectTo();
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: redirect ? { redirectTo: redirect } : undefined,
  });

  if (linkError) {
    return { emailed: false, provider: "none", message: linkError.message };
  }

  const actionLink =
    linkData.properties?.action_link ||
    (linkData as { action_link?: string }).action_link ||
    "";

  if (!actionLink) {
    return { emailed: false, provider: "none", message: "Could not generate reset link." };
  }

  const content = passwordResetEmailContent(actionLink);
  try {
    const viaResend = await sendViaResend({ to: email, content });
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
        message: error.message || "Email not sent. Configure RESEND_API_KEY + EMAIL_FROM.",
        actionLink,
      };
    }
    return { emailed: true, provider: "supabase_smtp", actionLink };
  } catch (e) {
    return {
      emailed: false,
      provider: "none",
      message: e instanceof Error ? e.message : "Email not sent.",
      actionLink,
    };
  }
}

export const INVITE_ENV_HINT =
  "Requires RESEND_API_KEY + EMAIL_FROM on Vercel, or Supabase Auth SMTP on the droplet (scripts/apply-resend-smtp-on-droplet.sh). Set NEXT_PUBLIC_SITE_URL to the app origin for reset links.";
