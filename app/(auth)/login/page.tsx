import type { Metadata } from "next";
import LoginForm from "./LoginForm";

export const metadata: Metadata = { title: "Sign In" };

const ERROR_MESSAGES: Record<string, string> = {
  account_disabled: "Your account profile hasn't been set up yet. Contact your administrator.",
  account_suspended: "Your account has been suspended. Contact your administrator.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; mode?: string }>;
}) {
  const { error, mode } = await searchParams;
  const errorMessage = error ? ERROR_MESSAGES[error] : null;
  const isSubcontractor = mode === "subcontractor";

  return (
    <div>
      <h1 className="text-2xl font-bold text-charcoal">
        {isSubcontractor ? "Subcontractor Login" : "Welcome back"}
      </h1>
      <p className="mt-2 text-sm text-muted">
        {isSubcontractor
          ? "Sign in to view assigned jobs, tag GPS, and upload before/after photos."
          : "Sign in to your Redline account to continue."}
      </p>
      {errorMessage && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4" role="alert">
          <p className="text-sm text-red-700">{errorMessage}</p>
        </div>
      )}
      <div className="mt-8">
        <LoginForm defaultNext={isSubcontractor ? "/my-jobs" : undefined} />
      </div>
    </div>
  );
}
