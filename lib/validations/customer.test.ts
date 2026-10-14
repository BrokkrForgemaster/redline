import { describe, expect, it } from "vitest";
import { customerSchema, propertySchema } from "./customer";

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

describe("customer optional fields", () => {
  it("accepts a form with required details and blank optional controls", () => {
    const result = customerSchema.safeParse({
      accountType: "individual", firstName: "Ada", lastName: "Fields",
      email: "ada@example.test", mobilePhone: "", alternatePhone: "",
      billingState: "", billingZip: "", preferredContact: "",
      taxExempt: false, portalAccess: false, tags: [],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.mobilePhone).toBeNull();
      expect(result.data.preferredContact).toBeNull();
    }
  });

  it("still rejects malformed entered optional values", () => {
    expect(customerSchema.safeParse({
      accountType: "individual", firstName: "Ada", lastName: "Fields",
      email: "ada@example.test", mobilePhone: "not a phone",
    }).success).toBe(false);
  });
});
