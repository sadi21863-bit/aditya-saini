'use client'

import { useRouter, useSearchParams } from 'next/navigation';

export default function FeedFilter({ categories }: { categories: string[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const active = searchParams.get('category') || 'all';

  const setFilter = (cat: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (cat === 'all') {
      params.delete('category');
    } else {
      params.set('category', cat);
    }
    router.push(`/feed?${params.toString()}`);
  };

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar mb-6">
      <button
        onClick={() => setFilter('all')}
        className={`px-4 py-1.5 rounded-full font-mono text-[11px] font-medium tracking-wide transition-all border whitespace-nowrap ${
          active === 'all'
            ? 'bg-ic-ink border-ic-ink text-ic-paper'
            : 'bg-transparent border-ic-rule text-ic-muted hover:border-ic-ink hover:text-ic-ink'
        }`}
      >
        All
      </button>
      {categories.map((cat) => (
        <button
          key={cat}
          onClick={() => setFilter(cat)}
          className={`px-4 py-1.5 rounded-full font-mono text-[11px] font-medium tracking-wide transition-all border whitespace-nowrap ${
            active === cat
              ? 'bg-ic-ink border-ic-ink text-ic-paper'
              : 'bg-transparent border-ic-rule text-ic-muted hover:border-ic-ink hover:text-ic-ink'
          }`}
        >
          {cat}
        </button>
      ))}
    </div>
  );
}
