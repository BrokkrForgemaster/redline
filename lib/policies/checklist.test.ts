import { describe, expect, it } from "vitest";
import { validateChecklistSubmission } from "./checklist";

const itemId = "11111111-1111-4111-8111-111111111111";
const foreignId = "22222222-2222-4222-8222-222222222222";
const rules = [{ id: itemId, response_type: "text" as const, options: [] }];

describe("visit checklist contract", () => {
  it("rejects an item from a different frozen template", () => {
    expect(validateChecklistSubmission([
      { checklist_item_id: foreignId, completed: true, response_value: { text: "Done" } },
    ], rules)).toMatch(/not part/);
  });

  it("requires typed values for completed entries", () => {
    expect(validateChecklistSubmission([
      { checklist_item_id: itemId, completed: true, response_value: { text: "  " } },
    ], rules)).toMatch(/valid text/);
    expect(validateChecklistSubmission([
      { checklist_item_id: itemId, completed: true, response_value: { text: "Done" } },
    ], rules)).toBeNull();
  });

  it("rejects duplicate item IDs", () => {
    const response = { checklist_item_id: itemId, completed: false, response_value: { text: "" } };
    expect(validateChecklistSubmission([response, response], rules)).toMatch(/unique/);
  });
});
