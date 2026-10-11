"use client";

import { CheckCircle2, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

export interface ChecklistItem {
  id: string;
  label: string;
  response_type: "checkbox" | "text" | "number" | "photo" | "select";
  required: boolean;
  sort_order: number;
  options: string[];
}

export interface ChecklistSection {
  id: string;
  title: string;
  description: string | null;
  sort_order: number;
  checklist_items: ChecklistItem[];
}

export interface ChecklistResponse {
  completed: boolean;
  response_value: Record<string, unknown>;
  completed_at: string | null;
}

interface Props {
  sections: ChecklistSection[];
  responses: Record<string, ChecklistResponse>;
  onChange: (itemId: string, completed: boolean, value?: Record<string, unknown>) => void;
  disabled?: boolean;
}

export function ServiceChecklist({ sections, responses, onChange, disabled }: Props) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  if (!sections.length) return null;

  const totalRequired = sections.flatMap((s) => s.checklist_items).filter((i) => i.required).length;
  const completedRequired = sections
    .flatMap((s) => s.checklist_items)
    .filter((i) => i.required && responses[i.id]?.completed).length;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <p className="text-sm font-semibold text-charcoal">Service Checklist</p>
        {totalRequired > 0 && (
          <span className={`text-xs font-semibold rounded-full px-2.5 py-1 ${
            completedRequired === totalRequired
              ? "bg-green-100 text-green-700"
              : "bg-amber-100 text-amber-700"
          }`}>
            {completedRequired}/{totalRequired} required
          </span>
        )}
      </div>

      {sections.map((section) => {
        const isCollapsed = collapsed[section.id];
        const sectionItems = section.checklist_items;
        const sectionComplete = sectionItems.every((i) => !i.required || responses[i.id]?.completed);

        return (
          <div key={section.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <button
              type="button"
              onClick={() => setCollapsed((c) => ({ ...c, [section.id]: !c[section.id] }))}
              className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                {sectionComplete
                  ? <CheckCircle2 size={16} className="text-green-500 flex-shrink-0" />
                  : <AlertCircle size={16} className="text-amber-400 flex-shrink-0" />
                }
                <span className="text-sm font-semibold text-charcoal">{section.title}</span>
              </div>
              {isCollapsed
                ? <ChevronDown size={16} className="text-muted flex-shrink-0" />
                : <ChevronUp size={16} className="text-muted flex-shrink-0" />
              }
            </button>

            {!isCollapsed && (
              <div className="border-t border-gray-100 divide-y divide-gray-100">
                {sectionItems.map((item) => {
                  const resp = responses[item.id];
                  const isChecked = resp?.completed ?? false;

                  return (
                    <div key={item.id} className="px-5 py-3.5">
                      <label className={`flex items-start gap-3 ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}>
                        {/* Checkbox */}
                        <div className="flex-shrink-0 mt-0.5">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            disabled={disabled}
                            onChange={(e) => onChange(item.id, e.target.checked, resp?.response_value)}
                            className="w-5 h-5 rounded border-gray-300 text-lawn focus:ring-lawn focus:ring-offset-0 cursor-pointer disabled:cursor-not-allowed"
                          />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-sm ${isChecked ? "line-through text-muted" : "text-charcoal"}`}>
                              {item.label}
                            </span>
                            {item.required && !isChecked && (
                              <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" title="Required" />
                            )}
                          </div>
                        </div>
                      </label>

                      {/* Text response field — shown when item type is text */}
                      {item.response_type === "text" && (
                        <div className="mt-2 ml-8">
                          <textarea
                            value={(resp?.response_value?.text as string) ?? ""}
                            disabled={disabled}
                            placeholder="Add notes…"
                            rows={2}
                            onChange={(e) =>
                              onChange(item.id, isChecked, { ...resp?.response_value, text: e.target.value })
                            }
                            className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-lawn/30 disabled:bg-gray-50 disabled:cursor-not-allowed"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Returns true when all required checklist items are completed */
export function checklistComplete(
  sections: ChecklistSection[],
  responses: Record<string, ChecklistResponse>
): boolean {
  return sections
    .flatMap((s) => s.checklist_items)
    .filter((i) => i.required)
    .every((i) => responses[i.id]?.completed === true);
}
