import { requireApiUser } from "@/lib/api/auth";
import { apiError, apiOk } from "@/lib/api/errors";
import { beginIdempotentRequest, completeIdempotentRequest } from "@/lib/api/idempotency";

interface TrackingPointInput {
  point_uuid?: string;
  work_session_id?: string;
  device_id?: string;
  device_sequence?: number;
  latitude?: number;
  longitude?: number;
  accuracy_meters?: number;
  speed_meters_per_second?: number | null;
  heading_degrees?: number | null;
  captured_at_device?: string;
  source?: "native_background" | "native_foreground" | "web_foreground" | "offline_synced";
}

interface BatchBody {
  points?: TrackingPointInput[];
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function validatePoint(point: TrackingPointInput) {
  return Boolean(
    point.point_uuid &&
      isFiniteNumber(point.device_sequence) &&
      isFiniteNumber(point.latitude) &&
      isFiniteNumber(point.longitude) &&
      isFiniteNumber(point.accuracy_meters) &&
      point.captured_at_device
  );
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => ({}))) as BatchBody;
  const idempotency = await beginIdempotentRequest(
    auth.supabase,
    auth.user.id,
    "tracking:points:batch",
    request.headers.get("Idempotency-Key"),
    body
  );
  if (!idempotency.ok) return idempotency.response;

  const points = body.points ?? [];
  if (!Array.isArray(points) || points.length === 0 || points.length > 500) {
    return apiError(400, "VALIDATION_ERROR", "Batch must include 1 to 500 tracking points.");
  }

  const invalidIndex = points.findIndex((point) => !validatePoint(point));
  if (invalidIndex >= 0) {
    return apiError(400, "VALIDATION_ERROR", `Tracking point at index ${invalidIndex} is incomplete.`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = auth.supabase as any;
  const rows = points.map((point) => ({
    point_uuid: point.point_uuid,
    employee_id: auth.user.id,
    work_session_id: point.work_session_id ?? null,
    device_id: point.device_id ?? null,
    device_sequence: point.device_sequence,
    latitude: point.latitude,
    longitude: point.longitude,
    accuracy_meters: point.accuracy_meters,
    speed_meters_per_second: point.speed_meters_per_second ?? null,
    heading_degrees: point.heading_degrees ?? null,
    captured_at_device: point.captured_at_device,
    source: point.source ?? "offline_synced",
  }));

  const { error } = await sb
    .from("employee_location_points")
    .upsert(rows, {
      onConflict: "point_uuid,captured_at_device",
      ignoreDuplicates: true,
    });

  if (error) return apiError(500, "INTERNAL_ERROR", "Failed to accept tracking point batch.");

  const responseBody = { accepted: rows.length };
  await completeIdempotentRequest(auth.supabase, idempotency.id, 202, responseBody);
  return apiOk(responseBody, 202);
}
