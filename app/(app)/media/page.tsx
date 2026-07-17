import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import Image from "next/image";
import { formatDate } from "@/lib/utils/format";
import StatusBadge from "@/components/ui/StatusBadge";
import { Plus, ImageIcon, Eye, EyeOff, Star } from "lucide-react";

export const metadata = { title: "Gallery Management" };

export default async function GalleryManagementPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; category?: string }>;
}) {
  const { status = "all", category } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("gallery_projects")
    .select(`id, title, slug, category, status, featured, display_order, publication_date, created_at,
      gallery_images(id, url, thumbnail_url, image_type, sort_order)`)
    .order("display_order", { ascending: true });

  if (status !== "all") query = query.eq("status", status);
  if (category) query = query.eq("category", category);

  const { data: projects } = await query.limit(50);

  const statuses = ["all", "published", "draft", "archived"];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-charcoal">Gallery Management</h1>
          <p className="text-sm text-muted">Manage your project gallery and before-and-after photos.</p>
        </div>
        <Link href="/media/new" className="flex items-center gap-2 bg-redline text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-redline-dark transition-colors">
          <Plus size={16} /> New Project
        </Link>
      </div>

      <div className="flex gap-2 flex-wrap">
        {statuses.map(s => (
          <Link key={s} href={`/media?status=${s}`}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition-colors ${status === s ? "bg-charcoal text-white" : "bg-white border border-gray-200 text-muted hover:bg-gray-50"}`}>
            {s}
          </Link>
        ))}
      </div>

      {(!projects || projects.length === 0) ? (
        <div className="py-16 text-center bg-white rounded-xl border border-gray-200">
          <ImageIcon size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="font-medium text-charcoal">No gallery projects</p>
          <p className="text-sm text-muted mt-1">Create your first project to showcase your work</p>
          <Link href="/media/new" className="mt-4 inline-block text-sm text-redline hover:underline">Create Project</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects.map(project => {
            const images = Array.isArray(project.gallery_images) ? project.gallery_images : [];
            const coverImage = images.sort((a: Record<string, unknown>, b: Record<string, unknown>) => (a.sort_order as number) - (b.sort_order as number))[0];
            return (
              <div key={project.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden group">
                {/* Thumbnail */}
                <div className="relative aspect-video bg-gray-100">
                  {coverImage ? (
                    <Image
                      src={(coverImage as Record<string, unknown>).thumbnail_url as string ?? (coverImage as Record<string, unknown>).url as string}
                      alt={project.title}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <ImageIcon size={32} className="text-gray-300" />
                    </div>
                  )}
                  <div className="absolute top-2 right-2 flex gap-1">
                    {project.featured && (
                      <span className="bg-yellow-500 text-white text-xs px-1.5 py-0.5 rounded flex items-center gap-1">
                        <Star size={10} /> Featured
                      </span>
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-charcoal text-sm">{project.title}</p>
                      <p className="text-xs text-muted capitalize mt-0.5">{project.category?.replace(/_/g, " ")}</p>
                    </div>
                    <StatusBadge
                      label={project.status}
                      variant={project.status === "published" ? "green" : project.status === "draft" ? "yellow" : "gray"}
                    />
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <p className="text-xs text-muted">
                      {images.length} image{images.length !== 1 ? "s" : ""}
                      {project.publication_date && ` · ${formatDate(project.publication_date)}`}
                    </p>
                    <div className="flex gap-1">
                      {project.status === "published" ? (
                        <Link href={`/gallery/${project.slug}`} className="p-1 text-muted hover:text-lawn transition-colors" title="View public" target="_blank">
                          <Eye size={14} />
                        </Link>
                      ) : (
                        <span className="p-1 text-gray-200">
                          <EyeOff size={14} />
                        </span>
                      )}
                      <Link href={`/media/${project.id}/edit`} className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded transition-colors text-charcoal">
                        Edit
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
