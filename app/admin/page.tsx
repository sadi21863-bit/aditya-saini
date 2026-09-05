import { redirect } from "next/navigation";
import Link from "next/link";
import { isAdmin } from "@/lib/auth";

export const metadata = { title: "Admin — IdeaConnect" };

export default async function AdminPage() {
  const adminOk = await isAdmin();
  if (!adminOk) redirect("/");

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-normal text-ic-ink mb-1">Admin</h1>
        <p className="font-mono text-[12px] text-ic-muted">Lab operations and moderation.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/admin/ai-lab/archives" className="block rounded-2xl bg-ic-card/50 p-6 hover:bg-ic-card transition-colors">
          <h2 className="font-display text-lg text-ic-ink mb-1">Archive Moderation</h2>
          <p className="font-mono text-xs text-ic-muted">Review draft and flagged archives.</p>
        </Link>
        <Link href="/admin/usage" className="block rounded-2xl bg-ic-card/50 p-6 hover:bg-ic-card transition-colors">
          <h2 className="font-display text-lg text-ic-ink mb-1">Usage Dashboard</h2>
          <p className="font-mono text-xs text-ic-muted">Tokens per agent, 7-day trend, budget.</p>
        </Link>
      </div>
    </div>
  );
}
