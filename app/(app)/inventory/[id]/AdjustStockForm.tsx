"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Loader2, PlusCircle, MinusCircle } from "lucide-react";

interface Props {
  productId: string;
  currentQuantity: number;
  unitOfMeasure: string;
}

const REASONS = [
  { value: "adjustment", label: "Manual Adjustment" },
  { value: "receipt", label: "Stock Receipt" },
  { value: "usage", label: "Usage / Consumed" },
  { value: "return", label: "Return" },
  { value: "shrinkage", label: "Shrinkage / Loss" },
  { value: "count", label: "Physical Count Correction" },
];

export default function AdjustStockForm({ productId, currentQuantity, unitOfMeasure }: Props) {
  const router = useRouter();
  const [quantity, setQuantity] = useState("");
  const [direction, setDirection] = useState<"add" | "remove">("add");
  const [reason, setReason] = useState("adjustment");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseFloat(quantity);
    if (!qty || qty <= 0) {
      toast.error("Enter a valid quantity");
      return;
    }

    setSubmitting(true);
    const supabase = createClient();
    const change = direction === "add" ? qty : -qty;
    const newQty = Math.max(0, currentQuantity + change);

    // Use type assertion to handle untyped Supabase queries
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const txInsert = (supabase as any).from("inventory_transactions").insert({
      product_id: productId,
      transaction_type: reason,
      quantity_change: change,
      quantity_before: currentQuantity,
      quantity_after: newQty,
      notes: notes || null,
    }) as Promise<{ error: { message: string } | null }>;

    const { error: txError } = await txInsert;

    if (txError) {
      toast.error("Failed to record transaction");
      setSubmitting(false);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const productUpdate = (supabase as any)
      .from("products")
      .update({ current_quantity: newQty })
      .eq("id", productId) as Promise<{ error: { message: string } | null }>;

    const { error: updateError } = await productUpdate;

    if (updateError) {
      toast.error("Failed to update stock level");
      setSubmitting(false);
      return;
    }

    toast.success(`Stock ${direction === "add" ? "increased" : "decreased"} by ${qty} ${unitOfMeasure}`);
    setQuantity("");
    setNotes("");
    router.refresh();
    setSubmitting(false);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h2 className="font-semibold text-charcoal mb-4">Adjust Stock</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Direction toggle */}
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          <button
            type="button"
            onClick={() => setDirection("add")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium transition-colors ${
              direction === "add"
                ? "bg-lawn text-white"
                : "bg-white text-muted hover:bg-gray-50"
            }`}
          >
            <PlusCircle size={14} /> Add
          </button>
          <button
            type="button"
            onClick={() => setDirection("remove")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium transition-colors ${
              direction === "remove"
                ? "bg-red-500 text-white"
                : "bg-white text-muted hover:bg-gray-50"
            }`}
          >
            <MinusCircle size={14} /> Remove
          </button>
        </div>

        <div>
          <label className="block text-sm font-medium text-charcoal mb-1">
            Quantity ({unitOfMeasure})
          </label>
          <input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            min="0.01"
            step="0.01"
            required
            className="block w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-charcoal placeholder:text-muted focus:border-redline focus:ring-2 focus:ring-redline/20 outline-none transition-colors"
            placeholder="0"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-charcoal mb-1">Reason</label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="block w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-charcoal focus:border-redline focus:ring-2 focus:ring-redline/20 outline-none transition-colors"
          >
            {REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-charcoal mb-1">Notes (optional)</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="block w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-charcoal placeholder:text-muted focus:border-redline focus:ring-2 focus:ring-redline/20 outline-none transition-colors"
            placeholder="Reference number, notes…"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full flex items-center justify-center gap-2 bg-redline text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-redline-dark transition-colors disabled:opacity-60"
        >
          {submitting && <Loader2 size={14} className="animate-spin" />}
          Record Adjustment
        </button>
      </form>
    </div>
  );
}
