export interface ChecklistItemRule {
  id: string;
  response_type: "checkbox" | "text" | "number" | "photo" | "select";
  options: unknown;
}

export interface ChecklistSubmission {
  checklist_item_id: string;
  completed: boolean;
  response_value?: Record<string, unknown>;
}

export function validateChecklistSubmission(
  responses: ChecklistSubmission[],
  templateItems: ChecklistItemRule[]
): string | null {
  if (!responses.length || responses.length > 100) return "Provide 1 to 100 checklist responses.";
  const rules = new Map(templateItems.map(item => [item.id, item]));
  const seen = new Set<string>();
  for (const response of responses) {
    if (!response || typeof response.checklist_item_id !== "string" ||
        !/^[0-9a-f-]{36}$/i.test(response.checklist_item_id) || seen.has(response.checklist_item_id)) {
      return "Checklist item IDs must be unique.";
    }
    seen.add(response.checklist_item_id);
    const rule = rules.get(response.checklist_item_id);
    if (!rule) return "Checklist item is not part of this visit template.";
    if (typeof response.completed !== "boolean") return "Checklist completion must be a boolean.";
    const value = response.response_value ?? {};
    if (!value || typeof value !== "object" || Array.isArray(value)) return "Checklist value must be an object.";
    if (JSON.stringify(value).length > 6000) return "Checklist value is too large.";
    if (rule.response_type === "checkbox" && Object.keys(value).length) return "Checkbox values must be empty.";
    if (rule.response_type === "text" && (typeof value.text !== "string" || value.text.length > 5000 || (response.completed && !value.text.trim()))) {
      return "Enter valid text before completing this item.";
    }
    if (rule.response_type === "number" && (typeof value.number !== "number" || !Number.isFinite(value.number))) {
      return "Enter a valid number.";
    }
    if (rule.response_type === "select" && (!Array.isArray(rule.options) || !rule.options.includes(value.option))) {
      return "Select an allowed option.";
    }
    if (rule.response_type === "photo" && (typeof value.asset_id !== "string" || !/^[0-9a-f-]{36}$/i.test(value.asset_id))) {
      return "Select a saved photo.";
    }
  }
  return null;
}
