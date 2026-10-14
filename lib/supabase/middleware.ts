import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublicKey, getSupabaseUrl, hasSupabasePublicEnv } from "./env";

const protectedPaths = [
  "/dashboard",
  "/leads",
  "/customers",
  "/properties",
  "/estimates",
  "/contracts",
  "/jobs",
  "/calendar",
  "/snow-events",
  "/routes",
  "/invoices",
  "/payments",
  "/inventory",
  "/equipment",
  "/vehicles",
  "/suppliers",
  "/purchase-orders",
  "/employees",
  "/crews",
  "/time-tracking",
  "/media",
  "/reports",
  "/settings",
  "/audit-logs",
];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const url = request.nextUrl;
  const isPortalRoute = url.pathname.startsWith("/portal");
  const isProtected = protectedPaths.some((path) => url.pathname.startsWith(path));

  if (!hasSupabasePublicEnv()) {
    if (isPortalRoute || isProtected) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/login";
      redirectUrl.searchParams.set("error", "server_config");
      return NextResponse.redirect(redirectUrl);
    }

    return supabaseResponse;
  }

  const supabase = createServerClient(
    getSupabaseUrl(),
    getSupabasePublicKey(),
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthRoute = (url.pathname === "/login" && !url.searchParams.has("error")) ||
    url.pathname === "/forgot-password";

  if (!user && (isPortalRoute || isProtected)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("next", url.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (user && isAuthRoute) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/auth/setup";
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}
