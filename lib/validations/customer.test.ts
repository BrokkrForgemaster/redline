import { describe, expect, it } from "vitest";
import { propertySchema } from "./customer";

const base = {
  customerId: "9fe9179c-3805-48d5-af4a-f53607876287",
  addressLine1: "1 Main Street",
  city: "Lexington",
  state: "KY",
  zip: "40502",
  propertyType: "residential" as const,
};

describe("property coordinate validation", () => {
  it("requires a valid coordinate pair", () => {
    expect(propertySchema.safeParse({ ...base, latitude: 38.04, longitude: -84.5 }).success).toBe(true);
    expect(propertySchema.safeParse({ ...base, latitude: 38.04 }).success).toBe(false);
    expect(propertySchema.safeParse({ ...base, latitude: 91, longitude: -84.5 }).success).toBe(false);
    expect(propertySchema.safeParse({ ...base, latitude: 38.04, longitude: -181 }).success).toBe(false);
  });
});
