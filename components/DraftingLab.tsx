'use client';

import React, { useState, useEffect } from 'react';
import { Zap, Shield, Save, Info, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { saveToHangar } from '@/app/actions/visionActions';

export default function DraftingLab({ userId }: { userId: string }) {
    const [form, setForm] = useState({ title: '', hook: '', vision: '', logic: '' });
    const [luminosity, setLuminosity] = useState(0);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error' | '', text: string }>({ type: '', text: '' });

    // Live Luminosity Logic (Calculates effort in real-time)
    useEffect(() => {
        let score = 0;

        // 1. Structure (30%)
        if (form.vision.includes('##')) score += 15;
        if (form.vision.includes('*')) score += 15;

        // 2. Depth (40%)
        const words = form.vision.trim().split(/\s+/).filter(w => w.length > 0).length;
        if (words >= 250) score += 40;
        else if (words > 0) score += (words / 250) * 40;

        // 3. Logic/Explanation (30%)
        if (form.logic.trim().length > 50) score += 30;

        setLuminosity(Math.round(score));
    }, [form]);

    // THE SAVE HANDLER
    const handleAction = async (isBroadcast: boolean) => {
        setIsSaving(true);
        setMessage({ type: '', text: '' });

        try {
            const result = await saveToHangar({
                ...form,
                userId,
                // If they broadcast, we set status to AETHER, otherwise HANGAR
                status: isBroadcast ? 'AETHER' : 'HANGAR'
            });

            if (result.success) {
                setMessage({
                    type: 'success',
                    text: isBroadcast
                        ? "Broadcast Successful! Your vision is now in the Aether."
                        : `Secured to Hangar. Genesis Code: ${result.genesisCode?.substring(0, 12)}...`
                });
                // Optional: Clear form on broadcast
                if (isBroadcast) setForm({ title: '', hook: '', vision: '', logic: '' });
            } else {
                setMessage({ type: 'error', text: result.error || "Failed to secure vision." });
            }
        } catch (err) {
            setMessage({ type: 'error', text: "Server connection lost." });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-8 bg-slate-950 text-white rounded-[2.5rem] border border-slate-800 shadow-2xl">

            {/* Header Area */}
            <div className="flex justify-between items-center mb-10">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-3 tracking-tight">
                        <Shield className="text-blue-500" /> Drafting Lab
                    </h1>
                    <p className="text-slate-500 text-sm font-medium">Structure your vision for the Aether.</p>
                </div>

                {/* Luminosity Meter UI */}
                <div className="flex items-center gap-4 bg-slate-900 p-4 rounded-2xl border border-slate-800">
                    <div className="text-right">
                        <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Luminosity</p>
                        <p className={`text-xl font-mono font-bold ${luminosity >= 80 ? 'text-blue-400' : 'text-amber-500'}`}>
                            {luminosity}%
                        </p>
                    </div>
                    <div className="w-20 h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                            className={`h-full transition-all duration-500 ${luminosity >= 80 ? 'bg-blue-500' : 'bg-amber-500'}`}
                            style={{ width: `${luminosity}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* Inputs */}
            <div className="space-y-6">
                <input
                    placeholder="Vision Title"
                    className="w-full bg-slate-900 border border-slate-800 p-4 rounded-xl focus:ring-1 focus:ring-blue-500 outline-none text-xl font-bold"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                />

                <textarea
                    placeholder="The Hook (Max 140 chars)"
                    maxLength={140}
                    className="w-full bg-slate-900 border border-slate-800 p-4 rounded-xl focus:ring-1 focus:ring-blue-500 outline-none italic"
                    value={form.hook}
                    onChange={(e) => setForm({ ...form, hook: e.target.value })}
                />

                <textarea
                    placeholder="The Vision Body (Min 250 words, use ## and * for score)"
                    className="w-full h-64 bg-slate-900 border border-slate-800 p-4 rounded-xl focus:ring-1 focus:ring-blue-500 outline-none font-serif leading-relaxed"
                    value={form.vision}
                    onChange={(e) => setForm({ ...form, vision: e.target.value })}
                />

                <textarea
                    placeholder="The Logic (Technical dependencies & justifications)"
                    className="w-full bg-slate-900 border border-slate-800 p-4 rounded-xl focus:ring-1 focus:ring-blue-500 outline-none text-sm"
                    value={form.logic}
                    onChange={(e) => setForm({ ...form, logic: e.target.value })}
                />
            </div>

            {/* Status Feedback Message */}
            {message.text && (
                <div className={`mt-6 p-4 rounded-xl flex items-center gap-3 border ${message.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'
                    }`}>
                    {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                    <span className="text-sm font-semibold">{message.text}</span>
                </div>
            )}

            {/* Actions */}
            <div className="mt-8 flex justify-between items-center border-t border-slate-800 pt-8">
                <div className="flex items-center gap-2 text-slate-500 italic text-xs">
                    <Info size={14} />
                    Genesis hashing active.
                </div>

                <div className="flex gap-4">
                    <button
                        onClick={() => handleAction(false)}
                        disabled={isSaving}
                        className="px-6 py-3 rounded-full font-bold text-slate-400 hover:text-white hover:bg-slate-900 border border-slate-800 transition-all flex items-center gap-2"
                    >
                        {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                        Save to Hangar
                    </button>

                    <button
                        onClick={() => handleAction(true)}
                        disabled={luminosity < 80 || isSaving}
                        className={`px-8 py-3 rounded-full font-bold flex items-center gap-2 transition-all ${luminosity >= 80
                                ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg'
                                : 'bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700'
                            }`}
                    >
                        <Zap size={18} />
                        Broadcast
                    </button>
                </div>
            </div>
        </div>
    );
}