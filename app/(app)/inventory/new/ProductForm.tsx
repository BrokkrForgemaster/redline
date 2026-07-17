"use client";

import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createProduct } from "@/lib/actions/inventory";
import { Loader2, DollarSign } from "lucide-react";

// Use string for number fields to avoid zodResolver/zod v4 coerce type mismatch
interface FormValues {
  name: string;
  category: string;
  brand: string;
  unitOfMeasure: string;
  purchaseCost: string;
  billablePrice: string;
  currentQuantity: string;
  reorderPoint: string;
  reorderQuantity: string;
  minStock: string;
  maxStock: string;
  sku: string;
  barcode: string;
  supplierId: string;
  location: string;
  bin: string;
  manufacturerPart: string;
  taxable: boolean;
  active: boolean;
}

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  category: z.string().min(1, "Category is required"),
  brand: z.string().optional(),
  unitOfMeasure: z.string().min(1, "Unit of measure is required"),
  purchaseCost: z.string(),
  billablePrice: z.string(),
  currentQuantity: z.string(),
  reorderPoint: z.string(),
  reorderQuantity: z.string(),
  minStock: z.string(),
  maxStock: z.string(),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  supplierId: z.string().optional(),
  location: z.string().optional(),
  bin: z.string().optional(),
  manufacturerPart: z.string().optional(),
  taxable: z.boolean().default(true),
  active: z.boolean().default(true),
});

interface Supplier {
  id: string;
  company_name: string;
}

interface Props {
  suppliers: Supplier[];
}

const CATEGORIES = [
  "fertilizer",
  "seed",
  "mulch",
  "salt",
  "herbicide",
  "equipment",
  "supplies",
  "safety",
  "other",
];

const UNITS = ["bags", "gallons", "pounds", "tons", "each", "boxes", "pallets", "hours"];

export default function ProductForm({ suppliers }: Props) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as unknown as Resolver<FormValues>,
    defaultValues: {
      taxable: true,
      active: true,
      purchaseCost: "0",
      billablePrice: "0",
      currentQuantity: "0",
      reorderPoint: "0",
      reorderQuantity: "0",
      minStock: "0",
      maxStock: "0",
    },
  });

  const onSubmit = async (values: FormValues) => {
    const result = await createProduct({
      name: values.name,
      category: values.category,
      unitOfMeasure: values.unitOfMeasure,
      purchaseCost: parseFloat(values.purchaseCost) || 0,
      billablePrice: parseFloat(values.billablePrice) || 0,
      reorderPoint: parseInt(values.reorderPoint) || 0,
      reorderQuantity: parseInt(values.reorderQuantity) || 0,
      currentQuantity: parseFloat(values.currentQuantity) || 0,
      minStock: parseFloat(values.minStock) || 0,
      maxStock: parseFloat(values.maxStock) || 0,
      taxable: values.taxable,
      active: values.active,
      supplierId: values.supplierId || null,
      location: values.location || null,
      bin: values.bin || null,
      brand: values.brand || null,
      sku: values.sku || null,
      barcode: values.barcode || null,
      manufacturerPart: values.manufacturerPart || null,
    });

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success("Item added");
    router.push(`/inventory/${result.id}`);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Basic Info */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
        <h2 className="font-semibold text-charcoal">Basic Information</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">
              Name <span className="text-redline">*</span>
            </label>
            <input
              {...register("name")}
              type="text"
              className="block w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-charcoal placeholder:text-muted focus:border-redline focus:ring-2 focus:ring-redline/20 outline-none transition-colors"
              placeholder="e.g. Triple 13 Fertilizer"
            />
            {errors.name && <p className="mt-1 text-xs text-redline">{errors.name.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">
              Category <span className="text-redline">*</span>
            </label>
            <input
              {...register("category")}
              type="text"
              list="category-options"
              className="block w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-charcoal placeholder:text-muted focus:border-redline focus:ring-2 focus:ring-redline/20 outline-none transition-colors"
              placeholder="Select or type category"
            />
            <datalist id="category-options">
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat} />
              ))}
            </datalist>
            {errors.category && <p className="mt-1 text-xs text-redline">{errors.category.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Brand</label>
            <input
              {...register("brand")}
              type="text"
              className="block w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-charcoal placeholder:text-muted focus:border-redline focus:ring-2 focus:ring-redline/20 outline-none transition-colors"
              placeholder="e.g. Scott's"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">
              Unit of Measure <span className="text-redline">*</span>
            </label>
            <select
              {...register("unitOfMeasure")}
              className="block w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-charcoal focus:border-redline focus:ring-2 focus:ring-redline/20 outline-none transition-colors"
            >
              <option value="">Select unit…</option>
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
            {errors.unitOfMeasure && (
              <p className="mt-1 text-xs text-redline">{errors.unitOfMeasure.message}</p>
            )}
          </div>
        </div>
      </div>

      {/* Pricing */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
        <h2 className="font-semibold text-charcoal">Pricing</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Purchase Cost</label>
            <div className="relative">
              <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                {...register("purchaseCost")}
                type="number"
                min="0"
                step="0.01"
                className="block w-full rounded-lg border border-border bg-white pl-8 pr-4 py-2.5 text-sm text-charcoal placeholder:text-muted focus:border-redline focus:ring-2 focus:ring-redline/20 outline-none transition-colors"
                placeholder="0.00"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Billable Price</label>
            <div className="relative">
              <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                {...register("billablePrice")}
                type="number"
                min="0"
                step="0.01"
                className="block w-full rounded-lg border border-border bg-white pl-8 pr-4 py-2.5 text-sm text-charcoal placeholder:text-muted focus:border-redline focus:ring-2 focus:ring-redline/20 outline-none transition-colors"
                placeholder="0.00"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            {...register("taxable")}
            id="taxable"
            type="checkbox"
            className="rounded border-gray-300 text-redline focus:ring-redline"
          />
          <label htmlFor="taxable" className="text-sm text-charcoal">
            Taxable
          </label>
        </div>
      </div>

      {/* Stock Levels */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
        <h2 className="font-semibold text-charcoal">Stock Levels</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Current Quantity</label>
            <input
              {...register("currentQuantity")}
              type="number"
              min="0"
              step="0.01"
              className="block w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-charcoal placeholder:text-muted focus:border-redline focus:ring-2 focus:ring-redline/20 outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Reorder Point</label>
            <input
              {...register("reorderPoint")}
              type="number"
              min="0"
              step="1"
              className="block w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-charcoal placeholder:text-muted focus:border-redline focus:ring-2 focus:ring-redline/20 outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Reorder Quantity</label>
            <input
              {...register("reorderQuantity")}
              type="number"
              min="0"
              step="1"
              className="block w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-charcoal placeholder:text-muted focus:border-redline focus:ring-2 focus:ring-redline/20 outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Min Stock</label>
            <input
              {...register("minStock")}
              type="number"
              min="0"
              step="0.01"
              className="block w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-charcoal placeholder:text-muted focus:border-redline focus:ring-2 focus:ring-redline/20 outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Max Stock</label>
            <input
              {...register("maxStock")}
              type="number"
              min="0"
              step="0.01"
              className="block w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-charcoal placeholder:text-muted focus:border-redline focus:ring-2 focus:ring-redline/20 outline-none transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Identification */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
        <h2 className="font-semibold text-charcoal">Identification & Location</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">SKU</label>
            <input
              {...register("sku")}
              type="text"
              className="block w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-charcoal placeholder:text-muted focus:border-redline focus:ring-2 focus:ring-redline/20 outline-none transition-colors"
              placeholder="Internal SKU"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Barcode</label>
            <input
              {...register("barcode")}
              type="text"
              className="block w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-charcoal placeholder:text-muted focus:border-redline focus:ring-2 focus:ring-redline/20 outline-none transition-colors"
              placeholder="UPC / barcode"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Manufacturer Part #</label>
            <input
              {...register("manufacturerPart")}
              type="text"
              className="block w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-charcoal placeholder:text-muted focus:border-redline focus:ring-2 focus:ring-redline/20 outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Supplier</label>
            <select
              {...register("supplierId")}
              className="block w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-charcoal focus:border-redline focus:ring-2 focus:ring-redline/20 outline-none transition-colors"
            >
              <option value="">No supplier</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.company_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Storage Location</label>
            <input
              {...register("location")}
              type="text"
              className="block w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-charcoal placeholder:text-muted focus:border-redline focus:ring-2 focus:ring-redline/20 outline-none transition-colors"
              placeholder="e.g. Shed A"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Bin</label>
            <input
              {...register("bin")}
              type="text"
              className="block w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-charcoal placeholder:text-muted focus:border-redline focus:ring-2 focus:ring-redline/20 outline-none transition-colors"
              placeholder="e.g. B-12"
            />
          </div>
        </div>
      </div>

      {/* Status */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-2">
          <input
            {...register("active")}
            id="active"
            type="checkbox"
            className="rounded border-gray-300 text-redline focus:ring-redline"
          />
          <label htmlFor="active" className="text-sm font-medium text-charcoal">
            Active (visible in inventory)
          </label>
        </div>
      </div>

      {/* Submit */}
      <div className="flex items-center justify-end gap-3">
        <a
          href="/inventory"
          className="px-4 py-2 text-sm font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-charcoal"
        >
          Cancel
        </a>
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex items-center gap-2 bg-redline text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-redline-dark transition-colors disabled:opacity-60"
        >
          {isSubmitting && <Loader2 size={14} className="animate-spin" />}
          Add Item
        </button>
      </div>
    </form>
  );
}
