'use client';

import { useState } from 'react';
import { Zap } from 'lucide-react';
import { sparkVision } from '@/app/actions/sparkAction';

interface SparkProps {
    ideaId: string;       // UUID string
    viewerId: string;     // current user's ID
    initialLikes: number;
}

export default function SparkButton({ ideaId, viewerId, initialLikes }: SparkProps) {
    const [count, setCount] = useState(initialLikes);
    const [isActive, setIsActive] = useState(false);
    const [hasLiked, setHasLiked] = useState(false);

    const handleSpark = async () => {
        if (hasLiked) return;

        setIsActive(true);
        setCount(prev => prev + 1);

        const result = await sparkVision(ideaId, viewerId);

        if (!result.success) {
            setCount(prev => prev - 1);
            setIsActive(false);
            return;
        }

        setHasLiked(true);
        setTimeout(() => setIsActive(false), 1000);
    };

    return (
        <button
            onClick={handleSpark}
            disabled={isActive || hasLiked}
            className={`
        relative group flex items-center gap-3 px-6 py-2.5 rounded-full
        font-black transition-all duration-300 transform active:scale-95
        ${hasLiked
                    ? 'bg-blue-600 text-white cursor-default'
                    : isActive
                        ? 'bg-blue-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.6)]'
                        : 'bg-slate-900/80 text-slate-400 hover:text-blue-400 border border-slate-800 hover:border-blue-500/50'}
      `}
        >
            <Zap
                size={18}
                className={`transition-all duration-500 ${isActive || hasLiked ? 'fill-white rotate-12 scale-125' : 'group-hover:fill-blue-500/20'}`}
            />
            <span className="tracking-tighter font-mono text-lg">{count}</span>
            {isActive && (
                <span className="absolute inset-0 rounded-full animate-ping bg-blue-500/20 pointer-events-none" />
            )}
        </button>
    );
}
