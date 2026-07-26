import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function mtToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Denver",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const asOf = mtToday();
  const [housing, cars] = await Promise.all([
    supabase.rpc("accrue_housing_nightly", { p_as_of: asOf }),
    supabase.rpc("accrue_rental_cars", { p_as_of: asOf }),
  ]);

  if (housing.error || cars.error) {
    return NextResponse.json(
      {
        error: housing.error?.message || cars.error?.message,
        asOf,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    asOf,
    timezone: "America/Denver",
    housingAccruals: housing.data ?? 0,
    carAccruals: cars.data ?? 0,
    schedule: "Call this route daily shortly after midnight Mountain Time.",
  });
}
