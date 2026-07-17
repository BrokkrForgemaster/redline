export function generateDocumentNumber(prefix: string, year: number, sequence: number): string {
  return `${prefix}-${year}-${String(sequence).padStart(5, "0")}`;
}

export function parseDocumentNumber(number: string): { prefix: string; year: number; sequence: number } | null {
  const match = number.match(/^([A-Z]+)-(\d{4})-(\d+)$/);
  if (!match) return null;
  return {
    prefix: match[1],
    year: parseInt(match[2]),
    sequence: parseInt(match[3]),
  };
}

export function calculateTax(subtotal: number, taxRate: number): number {
  return Math.round(subtotal * taxRate) / 100;
}

export function calculateDiscount(subtotal: number, discountType: "percent" | "fixed", discountValue: number): number {
  if (discountType === "percent") {
    return Math.round(subtotal * discountValue) / 100;
  }
  return discountValue;
}

export function calculateTotal(params: {
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
}): number {
  return Math.max(0, params.subtotal - params.discountAmount + params.taxAmount);
}

export function calculateBalance(total: number, amountPaid: number): number {
  return Math.max(0, total - amountPaid);
}
