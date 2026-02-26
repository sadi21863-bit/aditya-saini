'use client'

import { useRouter, useSearchParams } from 'next/navigation';

export default function AetherFilter({ spheres }: { spheres: string[] }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const activeSphere = searchParams.get('sphere') || 'all';

    const setFilter = (sphere: string) => {
        const params = new URLSearchParams(searchParams.toString());
        if (sphere === 'all') {
            params.delete('sphere');
        } else {
            params.set('sphere', sphere);
        }
        router.push(`/aether?${params.toString()}`);
    };

    return (
        <div className="flex gap-3 overflow-x-auto pb-6 no-scrollbar mb-8">
            <button
                onClick={() => setFilter('all')}
                className={`px-6 py-2 rounded-full text-[10px] font-black tracking-widest transition-all border ${activeSphere === 'all'
                    ? 'bg-blue-600 border-blue-400 text-white shadow-[0_0_15px_rgba(37,99,235,0.3)]'
                    : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-700'
                    }`}
            >
                ALL_VISIONS
            </button>

            {spheres.map((sphere) => (
                <button
                    key={sphere}
                    onClick={() => setFilter(sphere)}
                    className={`px-6 py-2 rounded-full text-[10px] font-black tracking-widest uppercase transition-all border whitespace-nowrap ${activeSphere === sphere
                        ? 'bg-blue-600 border-blue-400 text-white shadow-[0_0_15px_rgba(37,99,235,0.3)]'
                        : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-700'
                        }`}
                >
                    {sphere}
                </button>
            ))}
        </div>
    );
}