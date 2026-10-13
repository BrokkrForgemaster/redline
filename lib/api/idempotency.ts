import { createHash } from "crypto";
import { isValidIdempotencyKey } from "@/lib/policies/idempotency";
import { apiError } from "./errors";
import type { ApiSupabaseClient } from "./auth";

export function hashRequestBody(body: unknown) {
  return createHash("sha256").update(JSON.stringify(body ?? null)).digest("hex");
}

export async function beginIdempotentRequest(
  supabase: ApiSupabaseClient,
  userId: string,
  scope: string,
  key: string | null,
  requestBody: unknown
) {
  if (!isValidIdempotencyKey(key)) {
    return {
      ok: false as const,
      response: apiError(
        400,
        "IDEMPOTENCY_KEY_REQUIRED",
        "A UUID v4 Idempotency-Key header is required for this write operation."
      ),
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const requestHash = hashRequestBody(requestBody);
  const { data: existing, error: existingError } = await sb
    .from("idempotency_keys")
    .select("id, request_hash, response_status, response_body, completed_at, locked_until")
    .eq("user_id", userId)
    .eq("scope", scope)
    .eq("key", key)
    .maybeSingle();

  if (existingError) {
    return {
      ok: false as const,
      response: apiError(500, "INTERNAL_ERROR", "Failed to check idempotency state."),
    };
  }

  if (existing?.completed_at) {
    if (existing.request_hash !== requestHash) {
      return {
        ok: false as const,
        response: apiError(409, "CONFLICT_FINALIZED_RECORD", "Idempotency key was reused with a different request body."),
      };
    }

    return {
      ok: false as const,
      response: Response.json(existing.response_body ?? {}, {
        status: existing.response_status ?? 200,
      }),
    };
  }

  if (existing) {
    if (existing.request_hash !== requestHash) {
      return { ok: false as const, response: apiError(409, "CONFLICT_FINALIZED_RECORD", "Idempotency key was reused with a different request body.") };
    }
    return { ok: false as const, response: apiError(409, "CONFLICT_FINALIZED_RECORD", "An earlier request is still processing; retry after reconciliation.") };
  }

  const { data: inserted, error: insertError } = await sb
    .from("idempotency_keys")
    .insert({
      key,
      user_id: userId,
      scope,
      request_hash: requestHash,
      locked_until: new Date(Date.now() + 60_000).toISOString(),
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    return {
      ok: false as const,
      response: apiError(500, "INTERNAL_ERROR", "Failed to create idempotency state."),
    };
  }

  return { ok: true as const, id: inserted.id as string, key, requestHash };
}

export async function completeIdempotentRequest(
  supabase: ApiSupabaseClient,
  idempotencyId: string,
  responseStatus: number,
  responseBody: unknown
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("idempotency_keys")
    .update({
      response_status: responseStatus,
      response_body: responseBody,
      completed_at: new Date().toISOString(),
      locked_until: null,
    })
    .eq("id", idempotencyId)
    .select("id")
    .single();
  if (error || !data) throw new Error("Idempotency result was not recorded.");
}
