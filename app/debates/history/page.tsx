import { auth }           from "@/lib/auth";
import { redirect }       from "next/navigation";
import { db }             from "@/db";
import { debates }        from "@/db/schema";
import { eq, desc }       from "drizzle-orm";
import Link               from "next/link";
import { relativeTime }   from "@/lib/time";
import type { Debate }    from "@/db/schema";

function DebateRow({ d }: { d: Debate }) {
  const href =
    d.status === "archived" && d.shareToken
      ? `/debates/share/${d.shareToken}`
      : `/debates/${d.id}`;
  return (
    <Link
      href={href}
      className="block py-4 border-b border-ic-rule/30 last:border-0 hover:bg-ic-card/30 -mx-3 px-3 rounded-xl transition-colors"
    >
      <p className="text-ic-ink text-sm font-display truncate">{d.title}</p>
      <p className="font-mono text-[10px] text-ic-muted mt-0.5">
        {relativeTime(d.createdAt)} · {d.status}
      </p>
    </Link>
  );
}

export default async function DebateHistoryPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const rows = await db.select().from(debates)
    .where(eq(debates.userId, session.user.id))
    .orderBy(desc(debates.createdAt))
    .limit(50);

  const inProgress = rows.filter(d => d.status === "in_progress");
  const archived   = rows.filter(d => d.status === "archived" && d.debateType === "full_debate");
  const quickTakes = rows.filter(d => d.status === "archived" && d.debateType === "quick_take");

  return (
    <main className="max-w-2xl mx-auto px-6 py-12">
      <div className="flex items-center justify-between mb-10">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-widest text-[#FB923C] mb-2">
            Quick Debate
          </p>
          <h1 className="font-display text-[clamp(28px,4vw,40px)] font-normal tracking-tight text-ic-ink">Debate History</h1>
        </div>
        <Link
          href="/debates/new"
          className="px-5 py-2.5 rounded-xl bg-[#F97316] text-white text-sm font-medium hover:bg-[#EA580C] transition-colors shrink-0"
        >
          New debate →
        </Link>
      </div>

      {inProgress.length > 0 && (
        <section className="mb-10">
          <p className="font-mono text-[11px] uppercase tracking-widest text-ic-muted mb-3">
            In Progress
          </p>
          {inProgress.map(d => <DebateRow key={d.id} d={d} />)}
        </section>
      )}
      {archived.length > 0 && (
        <section className="mb-10">
          <p className="font-mono text-[11px] uppercase tracking-widest text-ic-muted mb-3">
            Archived
          </p>
          {archived.map(d => <DebateRow key={d.id} d={d} />)}
        </section>
      )}
      {quickTakes.length > 0 && (
        <section>
          <p className="font-mono text-[11px] uppercase tracking-widest text-ic-muted mb-3">
            Quick Takes
          </p>
          {quickTakes.map(d => <DebateRow key={d.id} d={d} />)}
        </section>
      )}
      {rows.length === 0 && (
        <p className="text-ic-muted text-sm">
          No debates yet.{" "}
          <Link href="/debates/new" className="text-ic-accent hover:underline">
            Start one →
          </Link>
        </p>
      )}
    </main>
  );
}
