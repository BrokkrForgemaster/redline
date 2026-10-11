import { describe, expect, it } from "vitest";
import { decideGeofence } from "./geofence";

describe("geofence policy", () => {
  it("accepts accurate points inside the configured radius", () => {
    expect(
      decideGeofence({ distanceMeters: 18, accuracyMeters: 12, configuredRadiusMeters: 30 })
    ).toMatchObject({ result: "on_site", code: null });
  });

  it("requires retry for poor accuracy", () => {
    expect(
      decideGeofence({ distanceMeters: 10, accuracyMeters: 100, configuredRadiusMeters: 30 })
    ).toMatchObject({ result: "retry_required", code: "LOCATION_ACCURACY_TOO_LOW" });
  });

  it("requires override when near but outside the radius", () => {
    expect(
      decideGeofence({ distanceMeters: 42, accuracyMeters: 20, configuredRadiusMeters: 30 })
    ).toMatchObject({ result: "near", code: "OVERRIDE_REQUIRED" });
  });

  it("rejects accurate points outside the geofence", () => {
    expect(
      decideGeofence({ distanceMeters: 90, accuracyMeters: 15, configuredRadiusMeters: 30 })
    ).toMatchObject({ result: "outside", code: "OUTSIDE_GEOFENCE" });
  });
});
