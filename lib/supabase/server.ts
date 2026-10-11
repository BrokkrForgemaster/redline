import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getSupabasePublicKey, getSupabaseUrl } from "./env";

/** Service-role client — bypasses RLS. Use only in trusted server contexts. */
export function createAdminClient() {
  const url = getSupabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  return createSupabaseClient(url, key, { auth: { persistSession: false } });
}

export async function createClient() {
  const cookieStore = await cookies();

  // Database generic omitted: TS 5.9 can't resolve Supabase's template-literal
  // type parsing for the full schema — queries return `any`, explicit casts still work.
  return createServerClient(
    getSupabaseUrl(),
    getSupabasePublicKey(),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from Server Component — cookies will be set by middleware
          }
        },
      },
    }
  );
}
