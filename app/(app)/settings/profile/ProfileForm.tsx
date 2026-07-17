"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import { Camera, Loader2, X } from "lucide-react";
import { updateProfile, removeAvatar } from "@/lib/actions/profile";
import type { Profile } from "@/types/database";

interface Props {
  profile: Profile;
}

export default function ProfileForm({ profile }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isRemoving, startRemoveTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const initials = `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase();
  const currentAvatar = preview ?? profile.avatar_url ?? null;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setPreview(URL.createObjectURL(file));
  }

  function clearSelection() {
    setPreview(null);
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleRemoveAvatar() {
    startRemoveTransition(async () => {
      const result = await removeAvatar();
      if (result.error) {
        toast.error(result.error);
      } else {
        clearSelection();
        toast.success("Photo removed");
        router.refresh();
      }
    });
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    if (selectedFile) formData.set("avatar", selectedFile);

    startTransition(async () => {
      const result = await updateProfile(formData);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Profile saved");
        clearSelection();
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {/* Avatar */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold text-charcoal mb-4">Profile Photo</h2>
        <div className="flex items-center gap-6">
          <div className="relative group">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="relative w-20 h-20 rounded-full overflow-hidden focus:outline-none focus:ring-2 focus:ring-redline focus:ring-offset-2"
              aria-label="Change profile photo"
            >
              {currentAvatar ? (
                <Image
                  src={currentAvatar}
                  alt={`${profile.first_name} ${profile.last_name}`}
                  fill
                  className="object-cover"
                  unoptimized={!!preview}
                />
              ) : (
                <div className="w-full h-full bg-redline flex items-center justify-center">
                  <span className="text-white text-xl font-bold">{initials}</span>
                </div>
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-full">
                <Camera size={18} className="text-white" />
              </div>
            </button>
            {preview && (
              <button
                type="button"
                onClick={clearSelection}
                className="absolute -top-1 -right-1 w-5 h-5 bg-gray-700 text-white rounded-full flex items-center justify-center hover:bg-gray-900 transition-colors"
                aria-label="Cancel photo selection"
              >
                <X size={10} />
              </button>
            )}
          </div>

          <div className="space-y-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-sm font-medium text-redline hover:underline"
            >
              {currentAvatar ? "Change photo" : "Upload photo"}
            </button>
            {profile.avatar_url && !preview && (
              <div>
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  disabled={isRemoving}
                  className="text-sm text-muted hover:text-red-600 transition-colors disabled:opacity-50"
                >
                  {isRemoving ? "Removing…" : "Remove photo"}
                </button>
              </div>
            )}
            <p className="text-xs text-muted">JPG, PNG, WebP — max 5 MB</p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      </div>

      {/* Info */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="font-semibold text-charcoal">Personal Information</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">
              First Name <span className="text-redline">*</span>
            </label>
            <input
              name="first_name"
              type="text"
              required
              defaultValue={profile.first_name}
              className="block w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-charcoal placeholder:text-muted focus:border-redline focus:ring-2 focus:ring-redline/20 outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">
              Last Name <span className="text-redline">*</span>
            </label>
            <input
              name="last_name"
              type="text"
              required
              defaultValue={profile.last_name}
              className="block w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-charcoal placeholder:text-muted focus:border-redline focus:ring-2 focus:ring-redline/20 outline-none transition-colors"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-charcoal mb-1">Phone</label>
          <input
            name="phone"
            type="tel"
            defaultValue={profile.phone ?? ""}
            placeholder="(555) 000-0000"
            className="block w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-charcoal placeholder:text-muted focus:border-redline focus:ring-2 focus:ring-redline/20 outline-none transition-colors"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-charcoal mb-1">Email</label>
          <input
            type="email"
            value={profile.email}
            readOnly
            className="block w-full rounded-lg border border-border bg-gray-50 px-4 py-2.5 text-sm text-muted cursor-not-allowed outline-none"
          />
          <p className="mt-1 text-xs text-muted">Email is managed through your login and cannot be changed here.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-charcoal mb-1">Role</label>
          <input
            type="text"
            value={profile.role.replace(/_/g, " ")}
            readOnly
            className="block w-full rounded-lg border border-border bg-gray-50 px-4 py-2.5 text-sm text-muted cursor-not-allowed outline-none capitalize"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="flex items-center gap-2 bg-redline text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-redline-dark transition-colors disabled:opacity-60"
        >
          {isPending && <Loader2 size={14} className="animate-spin" />}
          Save Changes
        </button>
      </div>
    </form>
  );
}
