import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const publicPaths = ["/login", "/forgot-password"];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const { pathname } = request.nextUrl;

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return supabaseResponse;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthPage = publicPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );

  if (!user && !isAuthPage && pathname !== "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isAuthPage) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("must_change_password, onboarding_complete")
      .eq("id", user.id)
      .maybeSingle();
    const url = request.nextUrl.clone();
    if (profile?.must_change_password) url.pathname = "/onboarding/password";
    else if (profile && profile.onboarding_complete === false) url.pathname = "/onboarding/contact";
    else url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  if (user && !pathname.startsWith("/onboarding") && pathname !== "/") {
    const { data: profile } = await supabase
      .from("profiles")
      .select("must_change_password, onboarding_complete")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.must_change_password) {
      const url = request.nextUrl.clone();
      url.pathname = "/onboarding/password";
      return NextResponse.redirect(url);
    }
    if (profile && profile.onboarding_complete === false) {
      const url = request.nextUrl.clone();
      url.pathname = "/onboarding/contact";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
