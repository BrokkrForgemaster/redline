import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  // Database generic omitted: TS 5.9 can't resolve Supabase's template-literal
  // type parsing for the full schema — queries return `any`, explicit casts still work.
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
