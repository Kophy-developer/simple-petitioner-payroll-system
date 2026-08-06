import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendTwilioSms, twilioConfigured } from "@/lib/twilio";
import { requireCronAuth } from "@/lib/cron-auth";
import { checkoutReminderEmailContent } from "@/lib/email-templates";
import { sendViaResend } from "@/lib/invite-email";

export async function GET(request: Request) {
  const denied = requireCronAuth(request);
  if (denied) return denied;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: open, error } = await supabase
    .from("lodging_occupancies")
    .select(
      "id, user_id, room_number, check_in_at, profiles(email, phone, first_name, last_name), lodging_properties(name, kind)",
    )
    .is("check_out_at", null)
    .is("check_out_date", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let emailed = 0;
  let emailFailed = 0;
  const reminders = [];
  for (const row of open ?? []) {
    const profile = row.profiles as
      | { email: string; phone: string | null; first_name: string; last_name: string }
      | { email: string; phone: string | null; first_name: string; last_name: string }[]
      | null;
    const property = row.lodging_properties as
      | { name: string; kind: string }
      | { name: string; kind: string }[]
      | null;
    const person = Array.isArray(profile) ? profile[0] : profile;
    const prop = Array.isArray(property) ? property[0] : property;
    if (!person?.email) continue;

    const content = checkoutReminderEmailContent({
      firstName: person.first_name,
      propertyName: prop?.name ?? "lodging",
      roomNumber: row.room_number ?? "",
    });

    let emailDelivery: "sent" | "not_configured" | "failed" = "not_configured";
    try {
      const via = await sendViaResend({ to: person.email, content });
      if (via) {
        emailDelivery = "sent";
        emailed += 1;
      }
    } catch {
      emailDelivery = "failed";
      emailFailed += 1;
    }

    let sms: Awaited<ReturnType<typeof sendTwilioSms>> | null = null;
    if (twilioConfigured() && person.phone) {
      sms = await sendTwilioSms(person.phone, content.text);
    }

    reminders.push({
      occupancyId: row.id,
      email: person.email,
      subject: content.subject,
      emailDelivery,
      sms,
    });
  }

  return NextResponse.json({
    ok: true,
    openCount: open?.length ?? 0,
    reminders,
    emailed,
    emailFailed,
    smsDelivery: twilioConfigured() ? "attempted_when_phone_present" : "twilio_not_configured",
  });
}
