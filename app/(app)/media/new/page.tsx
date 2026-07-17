import GalleryProjectForm from "./GalleryProjectForm";

export const metadata = { title: "New Gallery Project" };

export default function NewGalleryProjectPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <nav className="flex items-center gap-2 text-sm mb-4">
          <a href="/media" className="text-sm text-muted hover:text-charcoal">
            Gallery
          </a>
          <span className="text-muted">/</span>
          <span className="text-charcoal font-medium">New Project</span>
        </nav>
        <h1 className="text-2xl font-bold text-charcoal">New Gallery Project</h1>
      </div>
      <GalleryProjectForm />
    </div>
  );
}
