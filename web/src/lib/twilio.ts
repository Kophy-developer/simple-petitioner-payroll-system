export type TwilioSmsResult =
  | { sent: true; sid: string }
  | { sent: false; reason: "not_configured" | "missing_to" | "error"; detail?: string };

export function twilioConfigured() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_FROM_NUMBER,
  );
}

export async function sendTwilioSms(to: string, body: string): Promise<TwilioSmsResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  const trimmedTo = to.trim();

  if (!trimmedTo) return { sent: false, reason: "missing_to" };
  if (!accountSid || !authToken || !from) return { sent: false, reason: "not_configured" };

  try {
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
    const params = new URLSearchParams({ To: trimmedTo, From: from, Body: body });
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      },
    );
    if (!response.ok) {
      const detail = await response.text();
      return { sent: false, reason: "error", detail };
    }
    const json = (await response.json()) as { sid?: string };
    return { sent: true, sid: json.sid ?? "ok" };
  } catch (e) {
    return {
      sent: false,
      reason: "error",
      detail: e instanceof Error ? e.message : "Twilio request failed",
    };
  }
}
