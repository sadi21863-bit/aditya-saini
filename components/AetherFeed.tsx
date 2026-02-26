import VisionSection from './VisionSection';
import SparkButton from './SparkButton'; // New interactive component
import { ArrowBigDown, Share2, MessageSquare } from 'lucide-react';

export default function AetherFeed({ ideas, userTier }: { ideas: any[], userTier: number }) {
    return (
        <div className="max-w-2xl mx-auto space-y-6 p-4">
            {ideas.map((idea) => (
                <div key={idea.id} className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow">

                    {/* Header: Category & Author */}
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex flex-col">
                            <span className="text-xs font-bold uppercase tracking-widest text-blue-600 bg-blue-50 px-3 py-1 rounded-full w-fit">
                                {idea.category}
                            </span>
                            <span className="text-[10px] font-bold text-slate-400 mt-1 ml-1">
                                BY @{idea.user?.handle || 'pioneer'} • TIER {idea.user?.tier || 1}
                            </span>
                        </div>
                        <span className="text-slate-400 text-xs">{new Date(idea.createdAt).toLocaleDateString()}</span>
                    </div>

                    {/* Body: Title & Hook */}
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">{idea.title}</h2>
                    <p className="text-slate-600 text-lg mb-6 leading-snug">
                        {idea.hook}
                    </p>

                    {/* STEP 5 Integration: The Vision Section (Pass the full idea object) */}
                    <VisionSection userTier={userTier} idea={idea} />

                    {/* Footer: Interactions */}
                    <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-50">
                        <div className="flex items-center gap-4">

                            {/* LIVE INTERACTION: The Spark Engine */}
                            <SparkButton
                                ideaId={idea.id}
                                authorId={idea.userId}
                                initialSparks={idea.sparks}
                            />

                            {/* Void Vote (We'll wire this logic in the next session) */}
                            <button className="flex items-center gap-1 text-slate-400 hover:text-purple-600 transition-colors">
                                <ArrowBigDown size={22} />
                                <span className="font-bold text-sm">{idea.voidVotes || 0}</span>
                            </button>
                        </div>

                        <div className="flex items-center gap-3">
                            <button className="p-2 text-slate-400 hover:bg-slate-50 rounded-full">
                                <MessageSquare size={20} />
                            </button>
                            <button className="p-2 text-slate-400 hover:bg-slate-50 rounded-full">
                                <Share2 size={20} />
                            </button>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}