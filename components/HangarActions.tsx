'use client'

import { useState } from 'react';
import { Trash2, Zap, Loader2 } from 'lucide-react';
import { scrapVision, boostLuminosity } from '@/app/actions/hangarActions';

export default function HangarActions({ ideaId }: { ideaId: number }) {
    const [loading, setLoading] = useState<string | null>(null);

    const onScrap = async () => {
        if (!confirm("Permanently scrap this vision? This action is final.")) return;
        setLoading('scrap');
        await scrapVision(ideaId);
        setLoading(null);
    };

    const onBoost = async () => {
        setLoading('boost');
        await boostLuminosity(ideaId);
        setLoading(null);
    };

    return (
        <div className="flex gap-2">
            <button
                onClick={onBoost}
                disabled={!!loading}
                className="flex-1 flex items-center justify-center gap-2 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 rounded-xl text-[10px] font-bold transition-all"
            >
                {loading === 'boost' ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
                BOOST LUM
            </button>

            <button
                onClick={onScrap}
                disabled={!!loading}
                className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl transition-all"
            >
                {loading === 'scrap' ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            </button>
        </div>
    );
}