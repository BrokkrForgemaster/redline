"use server";

import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";
import { randomUUID } from "crypto";

interface AuditParams {
  action: string;
  entityType: string;
  entityId?: string;
  beforeData?: Record<string, unknown>;
  afterData?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export async function logAudit(params: AuditParams): Promise<void> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    await supabase.from("audit_logs").insert({
      actor_id: user?.id ?? null,
      actor_email: user?.email ?? null,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId ?? null,
      before_data: (params.beforeData ?? null) as Json,
      after_data: (params.afterData ?? null) as Json,
      metadata: (params.metadata ?? null) as Json,
      correlation_id: randomUUID() as unknown as string,
    });
  } catch {
    // Audit failures must not break the main operation
  }
}
