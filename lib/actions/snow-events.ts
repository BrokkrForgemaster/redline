"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "./audit";
import { revalidatePath } from "next/cache";

const snowEventSchema = z.object({
  eventName: z.string().min(1, "Event name is required").max(200),
  forecastStart: z.string().optional().nullable(),
  forecastEnd: z.string().optional().nullable(),
  expectedSnowfallInches: z.number().min(0).optional().nullable(),
  iceRisk: z.boolean().default(false),
  temperatureLow: z.number().optional().nullable(),
  weatherNotes: z.string().max(2000).optional().nullable(),
  operationalPriority: z.enum(["low", "normal", "high", "emergency"]).default("normal"),
  eventNotes: z.string().max(5000).optional().nullable(),
  managerId: z.string().uuid().optional().nullable(),
});

export type SnowEventInput = z.infer<typeof snowEventSchema>;

async function getEventNumber(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string> {
  try {
    const { data: settings } = await supabase
      .from("business_settings")
      .select("snow_event_prefix")
      .single();

    const prefix = settings?.snow_event_prefix ?? "SNW";
    const year = new Date().getFullYear();

    const { data } = await supabase.rpc("get_next_number", { prefix, year });
    if (data) return data as string;
  } catch {
    // fallback
  }
  return `SNW-${Date.now()}`;
}

export async function createSnowEvent(input: SnowEventInput) {
  const parsed = snowEventSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const d = parsed.data;
  const eventNumber = await getEventNumber(supabase);

  const { data, error } = await supabase
    .from("snow_events")
    .insert({
      event_number: eventNumber,
      event_name: d.eventName,
      status: "monitoring",
      manager_id: d.managerId ?? null,
      forecast_start: d.forecastStart ?? null,
      forecast_end: d.forecastEnd ?? null,
      expected_snowfall_inches: d.expectedSnowfallInches ?? null,
      ice_risk: d.iceRisk,
      temperature_low: d.temperatureLow ?? null,
      weather_notes: d.weatherNotes ?? null,
      operational_priority: d.operationalPriority,
      event_notes: d.eventNotes ?? null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) {
    return { error: "Failed to create snow event. Please try again." };
  }

  await logAudit({
    action: "create",
    entityType: "snow_event",
    entityId: data.id,
    afterData: { event_number: eventNumber, event_name: d.eventName },
  });

  revalidatePath("/snow-events");
  return { id: data.id };
}

export async function updateSnowEvent(id: string, input: SnowEventInput) {
  const parsed = snowEventSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const d = parsed.data;

  const { error } = await supabase
    .from("snow_events")
    .update({
      event_name: d.eventName,
      manager_id: d.managerId ?? null,
      forecast_start: d.forecastStart ?? null,
      forecast_end: d.forecastEnd ?? null,
      expected_snowfall_inches: d.expectedSnowfallInches ?? null,
      ice_risk: d.iceRisk,
      temperature_low: d.temperatureLow ?? null,
      weather_notes: d.weatherNotes ?? null,
      operational_priority: d.operationalPriority,
      event_notes: d.eventNotes ?? null,
    })
    .eq("id", id);

  if (error) {
    return { error: "Failed to update snow event." };
  }

  await logAudit({
    action: "update",
    entityType: "snow_event",
    entityId: id,
  });

  revalidatePath(`/snow-events/${id}`);
  revalidatePath("/snow-events");
  return { id };
}

export async function updateSnowEventStatus(id: string, status: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const updates: Record<string, unknown> = { status: status as never };

  if (status === "in_progress" || status === "activated") {
    updates.actual_start = new Date().toISOString();
  }
  if (status === "completed" || status === "cancelled") {
    updates.actual_end = new Date().toISOString();
  }

  const { error } = await supabase
    .from("snow_events")
    .update(updates as never)
    .eq("id", id);

  if (error) {
    return { error: "Failed to update event status." };
  }

  await logAudit({
    action: "status_change",
    entityType: "snow_event",
    entityId: id,
    afterData: { status },
  });

  revalidatePath(`/snow-events/${id}`);
  revalidatePath("/snow-events");
  return { success: true };
}
