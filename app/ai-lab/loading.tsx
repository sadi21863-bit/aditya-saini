export default function AILabLoading() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-10 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="h-9 w-20 bg-slate-800 rounded-lg" />
        <div className="h-4 w-28 bg-slate-800 rounded" />
      </div>

      {/* Theme card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-6">
        <div className="h-3 w-28 bg-slate-800 rounded mb-3" />
        <div className="h-7 w-3/4 bg-slate-800 rounded" />
      </div>

      {/* Participant status bar — 3 circular skeletons */}
      <div className="flex flex-wrap items-center gap-6 mb-8 bg-slate-900/50 border border-slate-800 rounded-2xl px-5 py-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-slate-800 shrink-0" />
            <div>
              <div className="h-3 w-16 bg-slate-800 rounded mb-1.5" />
              <div className="h-2.5 w-12 bg-slate-800 rounded" />
            </div>
          </div>
        ))}
      </div>

      {/* Idea card skeletons — 2 cards */}
      {[0, 1].map((i) => (
        <div key={i} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden mb-6">
          <div className="px-6 pt-5 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-full bg-slate-800 shrink-0" />
              <div className="h-3 w-20 bg-slate-800 rounded" />
            </div>
            <div className="h-5 w-4/5 bg-slate-800 rounded mb-3" />
            <div className="space-y-2">
              <div className="h-3 w-full bg-slate-800 rounded" />
              <div className="h-3 w-5/6 bg-slate-800 rounded" />
              <div className="h-3 w-3/4 bg-slate-800 rounded" />
            </div>
          </div>
          <div className="px-6 py-3">
            <div className="h-3 w-24 bg-slate-800 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
