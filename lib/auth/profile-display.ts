import type { Profile } from "@/types/database";

export function getProfileDisplayName(profile: Pick<Profile, "first_name" | "last_name" | "email">) {
  const fullName = `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim();
  if (fullName && fullName.toLowerCase() !== "new user") return fullName;
  return profile.email;
}

export function getProfileInitials(profile: Pick<Profile, "first_name" | "last_name" | "email">) {
  const displayName = getProfileDisplayName(profile);
  const nameParts = displayName
    .replace(/@.*/, "")
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean);

  if (nameParts.length >= 2) return `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase();
  return displayName.slice(0, 2).toUpperCase();
}
