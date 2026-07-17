import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session — must not be removed or guarded
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const url = request.nextUrl;
  const isPortalRoute = url.pathname.startsWith("/portal");
  // Don't redirect away from /login when an error param is present — prevents infinite redirect loops
  // when the user's profile is missing or their account is disabled.
  const isAuthRoute = (url.pathname === "/login" && !url.searchParams.has("error")) ||
    url.pathname === "/forgot-password" ||
    url.pathname === "/reset-password";

  const protectedPaths = ["/dashboard", "/leads", "/customers", "/properties", "/estimates", "/contracts", "/jobs", "/calendar", "/snow-events", "/routes", "/invoices", "/payments", "/inventory", "/equipment", "/vehicles", "/suppliers", "/purchase-orders", "/employees", "/crews", "/time-tracking", "/media", "/reports", "/settings", "/audit-logs"];

  const isProtected = protectedPaths.some(path => url.pathname.startsWith(path));

  if (!user && (isPortalRoute || isProtected)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("next", url.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (user && isAuthRoute) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/dashboard";
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}
