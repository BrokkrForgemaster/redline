export type GeofenceResult =
  | "on_site"
  | "near"
  | "outside"
  | "retry_required"
  | "override_required";

export interface GeofencePolicy {
  normalAccuracyMeters: number;
  warningAccuracyMeters: number;
  nearBufferMeters: number;
}

export interface GeofenceDecisionInput {
  distanceMeters: number;
  accuracyMeters: number;
  configuredRadiusMeters: number;
  overrideRequested?: boolean;
  overrideReason?: string;
}

export const DEFAULT_GEOFENCE_POLICY: GeofencePolicy = {
  normalAccuracyMeters: 30,
  warningAccuracyMeters: 75,
  nearBufferMeters: 25,
};

export function decideGeofence(
  input: GeofenceDecisionInput,
  policy: GeofencePolicy = DEFAULT_GEOFENCE_POLICY
) {
  const insideRadius = input.distanceMeters <= input.configuredRadiusMeters;
  const withinNearBuffer =
    input.distanceMeters <= input.configuredRadiusMeters + policy.nearBufferMeters;

  if (input.accuracyMeters > policy.warningAccuracyMeters) {
    return {
      result: input.overrideRequested ? "override_required" : "retry_required",
      code: input.overrideRequested ? "OVERRIDE_REQUIRED" : "LOCATION_ACCURACY_TOO_LOW",
      warning: "Reported GPS accuracy is too low for an authoritative decision.",
    } as const;
  }

  if (insideRadius) {
    return {
      result: "on_site",
      code: null,
      warning:
        input.accuracyMeters > policy.normalAccuracyMeters
          ? "GPS accuracy is acceptable with warning."
          : null,
    } as const;
  }

  if (withinNearBuffer) {
    return {
      result: "near",
      code: "OVERRIDE_REQUIRED",
      warning: "Worker is near the geofence but outside the configured radius.",
    } as const;
  }

  return {
    result: input.overrideRequested ? "override_required" : "outside",
    code: input.overrideRequested ? "OVERRIDE_REQUIRED" : "OUTSIDE_GEOFENCE",
    warning: "Worker is outside the configured geofence.",
  } as const;
}
