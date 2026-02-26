"use client";

import { Activity, Database } from "lucide-react";

export default function SystemLog({ drafts }: { drafts: any[] }) {
  if (!drafts || !Array.isArray(drafts)) {
    return (
      <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 h-full font-mono">
        <div className="flex items-center gap-2 mb-6 text-blue-500 text-sm font-bold uppercase">
          <Database size={18} /> System_Status
        </div>
        <p className="text-[10px] text-slate-500 animate-pulse">INITIALIZING_TELEMETRY...</p>
      </div>
    );
  }

  const totalLikes = drafts.reduce((sum, d) => sum + (Number(d?.totalLikes) || 0), 0);

  const categories = Array.from(new Set(drafts.map(d => d.category).filter(Boolean))) as string[];

  return (
    <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 h-full font-mono">
      <div className="flex items-center gap-2 mb-6 text-blue-500">
        <Activity size={18} />
        <h2 className="text-sm uppercase tracking-widest font-bold text-white">Telemetry_Log</h2>
      </div>

      <div className="space-y-6">
        <div>
          <p className="text-[10px] text-slate-500 mb-2 uppercase tracking-tighter">Fleet Statistics</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-black/40 p-3 rounded-xl border border-slate-800">
              <span className="block text-xl font-bold text-white leading-none">{drafts.length}</span>
              <span className="text-[9px] text-slate-500 uppercase">Ideas</span>
            </div>
            <div className="bg-black/40 p-3 rounded-xl border border-slate-800">
              <span className="block text-xl font-bold text-blue-400 leading-none">{totalLikes}</span>
              <span className="text-[9px] text-slate-500 uppercase">Likes</span>
            </div>
          </div>
        </div>

        {categories.length > 0 && (
          <div>
            <p className="text-[10px] text-slate-500 mb-2 uppercase tracking-tighter">Categories</p>
            <div className="space-y-2">
              {categories.map((cat) => (
                <div key={cat} className="flex justify-between items-center text-[10px]">
                  <span className="text-slate-400 italic">{cat}</span>
                  <span className="text-blue-500 font-bold">
                    {drafts.filter(d => d.category === cat).length}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
