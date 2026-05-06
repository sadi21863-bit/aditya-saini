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
    <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar mb-8">
      <button
        onClick={() => setFilter('all')}
        className={`px-5 py-2 rounded-full text-xs font-bold tracking-wide transition-all border whitespace-nowrap ${
          active === 'all'
            ? 'bg-[#0d9488] border-[#0d9488] text-white shadow-md'
            : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-400 hover:border-[#0d9488] hover:text-[#0d9488]'
        }`}
      >
        All
      </button>
      {categories.map((cat) => (
        <button
          key={cat}
          onClick={() => setFilter(cat)}
          className={`px-5 py-2 rounded-full text-xs font-bold tracking-wide uppercase transition-all border whitespace-nowrap ${
            active === cat
              ? 'bg-[#0d9488] border-[#0d9488] text-white shadow-md'
              : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-400 hover:border-[#0d9488] hover:text-[#0d9488]'
          }`}
        >
          {cat}
        </button>
      ))}
    </div>
  );
}
