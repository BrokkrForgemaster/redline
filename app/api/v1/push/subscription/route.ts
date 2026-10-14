import { requireApiUser } from "@/lib/api/auth";
import { apiError, apiOk } from "@/lib/api/errors";
import { createAdminClient } from "@/lib/supabase/server";
import { isAllowedPushEndpoint, pushSubscriptionSchema } from "@/lib/push/endpoint";

export async function GET() {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) return apiError(503, "INTERNAL_ERROR", "Push alerts are not configured.");
  const sb = createAdminClient();
  const [{ data: preference, error: preferenceError }, { data: subscriptions, error: subscriptionError }] = await Promise.all([
    sb.from("push_preferences").select("push_enabled").eq("user_id", auth.user.id).maybeSingle(),
    sb.from("push_subscriptions").select("id").eq("user_id", auth.user.id).eq("enabled", true).limit(1),
  ]);
  if (preferenceError || subscriptionError) return apiError(500, "INTERNAL_ERROR", "Could not load push settings.");
  return apiOk({ publicKey, enabled: preference?.push_enabled === true && (subscriptions?.length ?? 0) > 0 });
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    return apiError(503, "INTERNAL_ERROR", "Push alerts are not configured.");
  }
  const parsed = pushSubscriptionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "VALIDATION_ERROR", "Invalid push subscription.");
  // The database function binds the endpoint to auth.uid() and sets the
  // server-stored preference in the same transaction.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (auth.supabase as any).rpc("register_push_subscription", {
    p_endpoint: parsed.data.endpoint,
    p_p256dh: parsed.data.keys.p256dh,
    p_auth_secret: parsed.data.keys.auth,
  });
  if (error || typeof data !== "string") return apiError(500, "INTERNAL_ERROR", "Could not save the push subscription.");
  return apiOk({ saved: true });
}

export async function PUT(request: Request) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  const body = await request.json().catch(() => null) as { endpoint?: unknown } | null;
  if (typeof body?.endpoint !== "string" || !isAllowedPushEndpoint(body.endpoint)) {
    return apiError(400, "VALIDATION_ERROR", "Invalid push subscription endpoint.");
  }
  const { data, error } = await createAdminClient().from("push_subscriptions")
    .select("id").eq("user_id", auth.user.id).eq("endpoint", body.endpoint).eq("enabled", true).limit(1);
  if (error) return apiError(500, "INTERNAL_ERROR", "Could not check device subscription.");
  return apiOk({ registered: (data?.length ?? 0) > 0 });
}

export async function DELETE(request: Request) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  const body = await request.json().catch(() => null) as { endpoint?: unknown } | null;
  if (typeof body?.endpoint !== "string" || !isAllowedPushEndpoint(body.endpoint)) {
    return apiError(400, "VALIDATION_ERROR", "Invalid push subscription endpoint.");
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (auth.supabase as any).rpc("unregister_push_subscription", {
    p_endpoint: body.endpoint,
  });
  if (error) return apiError(500, "INTERNAL_ERROR", "Could not disable push alerts.");
  return apiOk({ disabled: data === true });
}
