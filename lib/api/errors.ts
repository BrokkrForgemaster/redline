import { NextResponse } from "next/server";

export type ApiErrorCode =
  | "AUTH_REQUIRED"
  | "ACCOUNT_INACTIVE"
  | "MFA_REQUIRED"
  | "FORBIDDEN"
  | "ASSIGNMENT_REQUIRED"
  | "INVALID_STATE_TRANSITION"
  | "LOCATION_REQUIRED"
  | "LOCATION_ACCURACY_TOO_LOW"
  | "OUTSIDE_GEOFENCE"
  | "OVERRIDE_REQUIRED"
  | "TEMPLATE_INCOMPLETE"
  | "REQUIRED_PHOTOS_MISSING"
  | "OFFLINE_AUTHORIZATION_EXPIRED"
  | "CONFLICT_FINALIZED_RECORD"
  | "IDEMPOTENCY_KEY_REQUIRED"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "INTERNAL_ERROR";

export function apiError(status: number, code: ApiErrorCode, message: string, details?: unknown) {
  return NextResponse.json(
    {
      code,
      message,
      ...(details === undefined ? {} : { details }),
    },
    { status }
  );
}

export function apiOk<T>(body: T, status = 200) {
  return NextResponse.json(body, { status });
}
