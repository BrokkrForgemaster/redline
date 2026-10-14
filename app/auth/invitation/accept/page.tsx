import Link from "next/link";

export default function OldInvitationPage() {
  return <main className="mx-auto max-w-md space-y-3 p-6">
    <h1 className="text-2xl font-semibold">Invitation links are retired</h1>
    <p>Ask the owner to create your staff account and provide an initial password directly.</p>
    <Link href="/login" className="text-redline underline">Staff sign in</Link>
  </main>;
}
