export function safeAuthNext(value: string | null | undefined, fallback = "/dashboard") {
  if (!value || !value.startsWith("/") || value.startsWith("//") ||
      value.includes("\\") || /[\r\n]/.test(value)) return fallback;
  return value;
}

export function mfaDestination(currentLevel: string | null | undefined,
  nextLevel: string | null | undefined, next = "/dashboard") {
  if (currentLevel === "aal2" && nextLevel === "aal2") return null;
  const destination = nextLevel === "aal2" ? "/mfa/challenge" : "/auth/mfa/enroll";
  return `${destination}?next=${encodeURIComponent(safeAuthNext(next))}`;
}
