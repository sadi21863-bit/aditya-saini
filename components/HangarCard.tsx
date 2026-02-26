'use client'

import { useState } from 'react';
import { Rocket, Trash2, Loader2, Circle } from 'lucide-react';
import { launchVision as launchToAether, scrapVision } from '@/app/actions/hangarActions';

export default function HangarCard({ draft }: { draft: any }) {
    const [loading, setLoading] = useState<string | null>(null);

    const runAction = async (id: string, type: string, action: Function) => {
        setLoading(type);
        await action(id);
        setLoading(null);
    };

    return (
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 transition-all hover:bg-slate-900/60 hover:border-slate-700">
            <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-2 px-2 py-1 bg-slate-950 rounded-md border border-slate-800">
                    <Circle size={8} className="fill-amber-500 text-amber-500" />
                    <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">Docked</span>
                </div>
                <span className="text-[10px] font-bold text-blue-400/80 uppercase">
                    {draft.category ?? "General"}
                </span>
            </div>

            <h3 className="text-xl font-bold text-slate-100 mb-2">{draft.title}</h3>
            <p className="text-slate-500 text-sm leading-relaxed mb-8 line-clamp-2">{draft.hook}</p>

            <div className="flex gap-2">
                <button
                    onClick={() => runAction(draft.id, 'launch', launchToAether)}
                    disabled={!!loading}
                    className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-2"
                >
                    {loading === 'launch' ? <Loader2 size={14} className="animate-spin" /> : <Rocket size={14} />}
                    LAUNCH
                </button>

                <button
                    onClick={() => runAction(draft.id, 'scrap', scrapVision)}
                    disabled={!!loading}
                    className="px-4 py-2.5 bg-slate-800 hover:bg-red-900/40 text-slate-400 hover:text-red-500 rounded-xl transition-all"
                >
                    {loading === 'scrap' ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                </button>
            </div>
        </div>
    );
}
