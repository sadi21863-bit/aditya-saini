"use client";

import { BarChart3, Database } from "lucide-react";

export default function SystemLog({ drafts }: { drafts: any[] }) {
  if (!drafts || !Array.isArray(drafts)) {
    return (
      <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4 text-[#0d9488] text-sm font-bold">
          <Database size={16} /> Status
        </div>
        <p className="text-xs text-slate-400 animate-pulse">Loading telemetry...</p>
      </div>
    );
  }

  const totalLikes = drafts.reduce((sum, d) => sum + (Number(d?.totalLikes) || 0), 0);
  const categories = Array.from(new Set(drafts.map(d => d.category).filter(Boolean))) as string[];

  return (
    <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-6 text-[#0d9488]">
        <BarChart3 size={16} />
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Workspace Stats</h2>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-[#0d9488]/5 border border-[#0d9488]/10 p-4 rounded-2xl">
          <span className="block text-2xl font-bold text-slate-900" style={{ fontFamily: 'var(--font-playfair)' }}>
            {drafts.length}
          </span>
          <span className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold">Ideas</span>
        </div>
        <div className="bg-[#0d9488]/5 border border-[#0d9488]/10 p-4 rounded-2xl">
          <span className="block text-2xl font-bold text-[#0d9488]" style={{ fontFamily: 'var(--font-playfair)' }}>
            {totalLikes}
          </span>
          <span className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold">Likes</span>
        </div>
      </div>

      {categories.length > 0 && (
        <div>
          <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold mb-3">Categories</p>
          <div className="space-y-2">
            {categories.map((cat) => (
              <div key={cat} className="flex justify-between items-center text-xs">
                <span className="text-slate-600 font-medium">{cat}</span>
                <span className="text-[#0d9488] font-bold bg-[#0d9488]/10 px-2 py-0.5 rounded-full">
                  {drafts.filter(d => d.category === cat).length}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
