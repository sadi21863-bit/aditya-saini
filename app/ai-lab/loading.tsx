export default function AILabLoading() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      {/* Always-dark masthead skeleton */}
      <div className="bg-[#1A1814] h-40 rounded-2xl animate-pulse mb-6" />

      {/* Agent chip skeletons */}
      <div className="flex gap-3 mb-8">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-20 flex-1 bg-ic-rule animate-pulse rounded-xl" />
        ))}
      </div>

      {/* Idea card skeletons */}
      {[0, 1].map((i) => (
        <div key={i} className="bg-ic-card border border-ic-rule rounded-2xl overflow-hidden mb-6 animate-pulse">
          <div className="px-6 pt-5 pb-4 border-b border-ic-rule">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded bg-ic-rule shrink-0" />
              <div className="h-3 w-20 bg-ic-rule rounded" />
            </div>
            <div className="h-5 w-4/5 bg-ic-rule rounded mb-3" />
            <div className="space-y-2">
              <div className="h-3 w-full bg-ic-paper-deep rounded" />
              <div className="h-3 w-5/6 bg-ic-paper-deep rounded" />
              <div className="h-3 w-3/4 bg-ic-paper-deep rounded" />
            </div>
          </div>
          <div className="px-6 py-3">
            <div className="h-3 w-24 bg-ic-paper-deep rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
