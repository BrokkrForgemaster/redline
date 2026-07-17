"use client";

import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";
import { createGalleryProject, updateGalleryProject } from "@/lib/actions/gallery";
import { Loader2 } from "lucide-react";

const CATEGORIES = [
  { value: "lawn_mowing", label: "Lawn Mowing" },
  { value: "landscaping", label: "Landscaping" },
  { value: "aeration_overseeding", label: "Aeration & Overseeding" },
  { value: "snow_removal", label: "Snow Removal" },
  { value: "spring_cleanup", label: "Spring Cleanup" },
  { value: "hardscaping", label: "Hardscaping" },
  { value: "irrigation", label: "Irrigation" },
  { value: "other", label: "Other" },
];

const schema = z.object({
  title: z.string().min(1, "Title is required"),
  slug: z.string().min(1, "Slug is required").regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens"),
  category: z.string().min(1, "Category is required"),
  summary: z.string().optional(),
  description: z.string().optional(),
  city: z.string().optional(),
  property_type: z.enum(["residential", "commercial"]).default("residential"),
  services_performed: z.array(z.string()).default([]),
  completion_date: z.string().optional(),
  status: z.enum(["draft", "published"]).default("draft"),
  featured: z.boolean().default(false),
  seo_title: z.string().optional(),
  seo_description: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface ExistingProject {
  id: string;
  title?: string;
  slug?: string;
  category?: string;
  summary?: string;
  description?: string;
  city?: string;
  property_type?: string;
  services_performed?: string[];
  completion_date?: string;
  status?: string;
  featured?: boolean;
  seo_title?: string;
  seo_description?: string;
}

interface Props {
  project?: ExistingProject;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

export default function GalleryProjectForm({ project }: Props) {
  const router = useRouter();
  const isEdit = !!project;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as unknown as Resolver<FormValues>,
    defaultValues: {
      title: project?.title ?? "",
      slug: project?.slug ?? "",
      category: project?.category ?? "",
      summary: project?.summary ?? "",
      description: project?.description ?? "",
      city: project?.city ?? "",
      property_type: (project?.property_type as "residential" | "commercial") ?? "residential",
      services_performed: project?.services_performed ?? [],
      completion_date: project?.completion_date ?? "",
      status: (project?.status as "draft" | "published") ?? "draft",
      featured: project?.featured ?? false,
      seo_title: project?.seo_title ?? "",
      seo_description: project?.seo_description ?? "",
    },
  });

  const title = watch("title");

  // Auto-generate slug from title on new projects
  useEffect(() => {
    if (!isEdit && title) {
      setValue("slug", slugify(title), { shouldValidate: false });
    }
  }, [title, isEdit, setValue]);

  const onSubmit = async (values: FormValues) => {
    const payload: Record<string, unknown> = {
      title: values.title,
      slug: values.slug,
      category: values.category,
      summary: values.summary || null,
      description: values.description || null,
      city: values.city || null,
      property_type: values.property_type,
      services_performed: values.services_performed,
      completion_date: values.completion_date || null,
      status: values.status,
      featured: values.featured,
      seo_title: values.seo_title || null,
      seo_description: values.seo_description || null,
      publication_date: values.status === "published" ? new Date().toISOString() : null,
    };

    if (isEdit && project) {
      const result = await updateGalleryProject(project.id, payload);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Project updated");
      router.refresh();
    } else {
      const result = await createGalleryProject(payload);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Project created");
      router.push("/media");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Basic Info */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
        <h2 className="font-semibold text-charcoal">Project Details</h2>

        <div>
          <label className="block text-sm font-medium text-charcoal mb-1">
            Title <span className="text-redline">*</span>
          </label>
          <input
            {...register("title")}
            type="text"
            className="block w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-charcoal placeholder:text-muted focus:border-redline focus:ring-2 focus:ring-redline/20 outline-none transition-colors"
            placeholder="Front yard transformation — Smith residence"
          />
          {errors.title && <p className="mt-1 text-xs text-redline">{errors.title.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-charcoal mb-1">
            Slug <span className="text-redline">*</span>
          </label>
          <input
            {...register("slug")}
            type="text"
            className="block w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-charcoal font-mono placeholder:text-muted focus:border-redline focus:ring-2 focus:ring-redline/20 outline-none transition-colors"
            placeholder="front-yard-smith-residence"
          />
          {errors.slug && <p className="mt-1 text-xs text-redline">{errors.slug.message}</p>}
          <p className="mt-1 text-xs text-muted">Used in the public URL: /gallery/your-slug-here</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">
              Category <span className="text-redline">*</span>
            </label>
            <select
              {...register("category")}
              className="block w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-charcoal focus:border-redline focus:ring-2 focus:ring-redline/20 outline-none transition-colors"
            >
              <option value="">Select category…</option>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            {errors.category && (
              <p className="mt-1 text-xs text-redline">{errors.category.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Property Type</label>
            <select
              {...register("property_type")}
              className="block w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-charcoal focus:border-redline focus:ring-2 focus:ring-redline/20 outline-none transition-colors"
            >
              <option value="residential">Residential</option>
              <option value="commercial">Commercial</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">City</label>
            <input
              {...register("city")}
              type="text"
              className="block w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-charcoal placeholder:text-muted focus:border-redline focus:ring-2 focus:ring-redline/20 outline-none transition-colors"
              placeholder="Columbus"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Completion Date</label>
            <input
              {...register("completion_date")}
              type="date"
              className="block w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-charcoal focus:border-redline focus:ring-2 focus:ring-redline/20 outline-none transition-colors"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-charcoal mb-1">Summary</label>
          <input
            {...register("summary")}
            type="text"
            className="block w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-charcoal placeholder:text-muted focus:border-redline focus:ring-2 focus:ring-redline/20 outline-none transition-colors"
            placeholder="1-2 sentence overview of the project"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-charcoal mb-1">Full Description</label>
          <textarea
            {...register("description")}
            rows={5}
            className="block w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-charcoal placeholder:text-muted focus:border-redline focus:ring-2 focus:ring-redline/20 outline-none transition-colors"
            placeholder="Detailed description of the work performed, challenges, and results…"
          />
        </div>
      </div>

      {/* Services Performed */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="font-semibold text-charcoal">Services Performed</h2>
        <Controller
          control={control}
          name="services_performed"
          render={({ field }) => (
            <div className="grid grid-cols-2 gap-3">
              {CATEGORIES.map((cat) => (
                <label key={cat.value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={field.value.includes(cat.value)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        field.onChange([...field.value, cat.value]);
                      } else {
                        field.onChange(field.value.filter((v: string) => v !== cat.value));
                      }
                    }}
                    className="rounded border-gray-300 text-redline focus:ring-redline"
                  />
                  <span className="text-sm text-charcoal">{cat.label}</span>
                </label>
              ))}
            </div>
          )}
        />
      </div>

      {/* Publishing */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="font-semibold text-charcoal">Publishing</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Status</label>
            <select
              {...register("status")}
              className="block w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-charcoal focus:border-redline focus:ring-2 focus:ring-redline/20 outline-none transition-colors"
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </div>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <input
            {...register("featured")}
            id="featured"
            type="checkbox"
            className="rounded border-gray-300 text-redline focus:ring-redline"
          />
          <label htmlFor="featured" className="text-sm text-charcoal font-medium">
            Featured project (highlighted on gallery homepage)
          </label>
        </div>
      </div>

      {/* SEO */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="font-semibold text-charcoal">SEO (optional)</h2>
        <div>
          <label className="block text-sm font-medium text-charcoal mb-1">SEO Title</label>
          <input
            {...register("seo_title")}
            type="text"
            className="block w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-charcoal placeholder:text-muted focus:border-redline focus:ring-2 focus:ring-redline/20 outline-none transition-colors"
            placeholder="Overrides the page title in search results"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-charcoal mb-1">SEO Description</label>
          <textarea
            {...register("seo_description")}
            rows={3}
            className="block w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-charcoal placeholder:text-muted focus:border-redline focus:ring-2 focus:ring-redline/20 outline-none transition-colors"
            placeholder="Search engine description (150-160 characters)"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <a
          href="/media"
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
          {isEdit ? "Save Changes" : "Create Project"}
        </button>
      </div>
    </form>
  );
}
