import { redirect } from "next/navigation";
import Link from "next/link";
import { isAdmin } from "@/lib/auth";
import { db } from "@/db";
import { aiUsage } from "@/db/schema";
import { and, desc, gte, isNotNull } from "drizzle-orm";
import { QUOTA_CONFIG } from "@/lib/config";

export const metadata = { title: "Usage Dashboard — Admin" };

export default async function UsagePage() {
  const adminOk = await isAdmin();
  if (!adminOk) redirect("/");

  const today = new Date().toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const dailyCeiling = Math.floor(QUOTA_CONFIG.DAILY_TPD_LIMIT * QUOTA_CONFIG.AI_LAB_BUDGET_FRACTION);

  // Last 7 days per-agent rows (agent-driven usage, not IP rate-limit rows)
  const rows = await db
    .select({
      date: aiUsage.date,
      agentId: aiUsage.agentId,
      requestCount: aiUsage.requestCount,
      tokens: aiUsage.tokens,
      lastProvider: aiUsage.lastProvider,
    })
    .from(aiUsage)
    .where(and(isNotNull(aiUsage.agentId), isNotNull(aiUsage.date), gte(aiUsage.date, sevenDaysAgo)))
    .orderBy(desc(aiUsage.date), aiUsage.agentId);

  // Aggregate per day
  const byDate = new Map<string, { tokens: number; requests: number; agents: typeof rows }>();
  for (const r of rows) {
    const d = String(r.date);
    if (!byDate.has(d)) byDate.set(d, { tokens: 0, requests: 0, agents: [] });
    const entry = byDate.get(d)!;
    entry.tokens += Number(r.tokens ?? 0);
    entry.requests += Number(r.requestCount ?? 0);
    entry.agents.push(r);
  }

  const dates = Array.from(byDate.keys()).sort().reverse();
  const maxTokens = Math.max(1, ...Array.from(byDate.values()).map((v) => v.tokens), dailyCeiling);

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <div className="mb-8">
        <p className="font-mono text-[11px] uppercase tracking-widest text-ic-muted mb-2">
          <Link href="/admin" className="hover:text-ic-ink transition-colors">
            Admin
          </Link>{" "}
          · Usage
        </p>
        <h1 className="font-display text-3xl font-normal text-ic-ink mb-1">Usage Dashboard</h1>
        <p className="font-mono text-[12px] text-ic-muted">
          Tokens per agent over the last 7 days. Budget {dailyCeiling.toLocaleString()} TPD · Today {today}
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl bg-ic-card/50 p-8 text-center">
          <p className="font-mono text-sm text-ic-muted">No usage rows in the last 7 days.</p>
          <p className="font-mono text-xs text-ic-muted mt-1">Token accounting started 2026-08-23; older rows show 0 tokens.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Daily bars */}
          <div className="rounded-2xl bg-ic-card/50 p-6">
            <h2 className="font-mono text-[11px] uppercase tracking-widest text-ic-muted mb-4">Daily tokens vs budget</h2>
            <div className="space-y-3">
              {dates.map((d) => {
                const entry = byDate.get(d)!;
                const pct = Math.min(100, Math.round((entry.tokens / maxTokens) * 100));
                const budgetPct = Math.min(100, Math.round((dailyCeiling / maxTokens) * 100));
                const overBudget = entry.tokens > dailyCeiling;
                return (
                  <div key={d} className="relative">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-xs text-ic-ink">{d}</span>
                      <span className="font-mono text-xs text-ic-muted">
                        {entry.tokens.toLocaleString()} tokens · {entry.requests} requests {overBudget && <span className="text-amber-600">· over budget</span>}
                      </span>
                    </div>
                    <div className="relative h-3 rounded-full bg-ic-rule/30 overflow-hidden">
                      {/* Budget marker */}
                      <div className="absolute inset-y-0 w-px bg-amber-500/60" style={{ left: `${budgetPct}%` }} title={`Budget ${dailyCeiling.toLocaleString()}`} />
                      <div className="h-full rounded-full bg-[#0D0C0A] transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="font-mono text-[10px] text-ic-muted mt-3">Amber line = daily budget ({dailyCeiling.toLocaleString()} TPD)</p>
          </div>

          {/* Per-agent table for most recent day with data */}
          {dates.map((d) => {
            const entry = byDate.get(d)!;
            return (
              <div key={d} className="rounded-2xl bg-ic-card/50 p-6">
                <h3 className="font-mono text-[11px] uppercase tracking-widest text-ic-muted mb-3">{d} · by agent</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="font-mono text-[10px] uppercase tracking-widest text-ic-muted border-b border-ic-rule/30">
                        <th className="text-left py-2 font-normal">Agent</th>
                        <th className="text-right py-2 font-normal">Requests</th>
                        <th className="text-right py-2 font-normal">Tokens</th>
                        <th className="text-left py-2 font-normal pl-4">Provider</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entry.agents
                        .slice()
                        .sort((a, b) => Number(b.tokens ?? 0) - Number(a.tokens ?? 0))
                        .map((r) => (
                          <tr key={r.agentId} className="border-b border-ic-rule/15 last:border-0">
                            <td className="py-2 font-mono text-xs text-ic-ink">{r.agentId}</td>
                            <td className="py-2 font-mono text-xs text-ic-muted text-right">{r.requestCount}</td>
                            <td className="py-2 font-mono text-xs text-ic-ink text-right">{Number(r.tokens ?? 0).toLocaleString()}</td>
                            <td className="py-2 font-mono text-xs text-ic-muted pl-4">{r.lastProvider ?? "—"}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
