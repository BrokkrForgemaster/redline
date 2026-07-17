import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import GalleryProjectForm from "../../new/GalleryProjectForm";
import GalleryImageManager from "@/components/app/GalleryImageManager";
import DeleteProjectButton from "./DeleteProjectButton";
import type { GalleryProject, GalleryImage } from "@/types/database";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("gallery_projects")
    .select("title")
    .eq("id", id)
    .single();
  const proj = data as { title?: string } | null;
  return { title: proj?.title ? `Edit — ${proj.title}` : "Edit Gallery Project" };
}

export default async function EditGalleryProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: rawProject } = await supabase
    .from("gallery_projects")
    .select("*")
    .eq("id", id)
    .single();

  if (!rawProject) notFound();

  const project = rawProject as unknown as GalleryProject;

  const { data: rawImages } = await supabase
    .from("gallery_images")
    .select("id, url, thumbnail_url, caption, alt_text, image_type, sort_order, storage_path")
    .eq("project_id", id)
    .order("sort_order", { ascending: true });

  const images = (rawImages ?? []) as unknown as Pick<
    GalleryImage,
    "id" | "url" | "thumbnail_url" | "caption" | "alt_text" | "image_type" | "sort_order"
  >[] & { storage_path: string }[];

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm">
        <Link href="/media" className="text-sm text-muted hover:text-charcoal">
          Gallery
        </Link>
        <span className="text-muted">/</span>
        <span className="text-muted">{project.title}</span>
        <span className="text-muted">/</span>
        <span className="text-charcoal font-medium">Edit</span>
      </nav>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-charcoal">Edit Gallery Project</h1>
        <DeleteProjectButton projectId={id} projectTitle={project.title} />
      </div>

      {/* Project details form */}
      <GalleryProjectForm
        project={{
          id: project.id,
          title: project.title,
          slug: project.slug ?? undefined,
          category: project.category ?? undefined,
          summary: project.summary ?? undefined,
          description: project.description ?? undefined,
          city: project.city ?? undefined,
          property_type: project.property_type ?? undefined,
          services_performed: project.services_performed ?? [],
          completion_date: project.completion_date ?? undefined,
          status: project.status,
          featured: project.featured ?? false,
          seo_title: project.seo_title ?? undefined,
          seo_description: project.seo_description ?? undefined,
        }}
      />

      {/* Images Section */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-5 border-b border-gray-100">
          <h2 className="font-semibold text-charcoal">Project Images</h2>
          <p className="text-xs text-muted mt-0.5">
            {images.length} image{images.length !== 1 ? "s" : ""} · Upload, label, and remove photos for this project
          </p>
        </div>
        <div className="p-5">
          <GalleryImageManager
            projectId={id}
            initialImages={images.map(img => ({
              id: img.id,
              url: img.url,
              thumbnail_url: img.thumbnail_url ?? null,
              caption: img.caption ?? null,
              alt_text: img.alt_text ?? "",
              image_type: img.image_type ?? null,
              sort_order: img.sort_order ?? null,
              storage_path: (img as { storage_path?: string }).storage_path ?? "",
            }))}
          />
        </div>
      </div>
    </div>
  );
}
