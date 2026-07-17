"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { deleteGalleryProject } from "@/lib/actions/gallery";
import { toast } from "sonner";

interface Props {
  projectId: string;
  projectTitle: string;
}

export default function DeleteProjectButton({ projectId, projectTitle }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    setDeleting(true);
    const result = await deleteGalleryProject(projectId);
    if (result.error) {
      toast.error(result.error);
      setDeleting(false);
      setConfirming(false);
    } else {
      toast.success("Project deleted");
      router.push("/media");
    }
  };

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted">Delete &ldquo;{projectTitle}&rdquo;?</span>
        <button
          onClick={() => setConfirming(false)}
          className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-charcoal"
        >
          Cancel
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-60"
        >
          {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
          Confirm Delete
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
    >
      <Trash2 size={12} />
      Delete Project
    </button>
  );
}
