"use client";
import { useState } from "react";
import { Bold, Italic, List, ImageIcon, Save, Zap, Layout } from "lucide-react";

export default function DraftEditor() {
    const [content, setContent] = useState("");

    return (
        <div className="flex flex-col h-[600px] w-full bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
            {/* 🛠 TOOLBAR */}
            <div className="flex items-center justify-between p-3 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-1">
                    <ToolbarButton icon={<Bold size={18} />} label="Bold" />
                    <ToolbarButton icon={<Italic size={18} />} label="Italic" />
                    <ToolbarButton icon={<List size={18} />} label="Bullet List" />
                    <div className="w-px h-6 bg-slate-200 mx-2" />
                    <ToolbarButton icon={<ImageIcon size={18} />} label="Insert Image" />
                    <ToolbarButton icon={<Layout size={18} />} label="Use Template" />
                </div>

                <div className="flex items-center gap-3">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Auto-saved 2m ago</span>
                    <button className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-black hover:bg-black transition-all">
                        <Save size={14} /> MOVE TO HANGAR
                    </button>
                </div>
            </div>

            {/* 📝 WRITING CANVAS */}
            <div className="flex-1 flex gap-6 p-8 overflow-y-auto">
                {/* Left: Metadata/Side-tools */}
                <div className="w-1/4 space-y-6 border-r border-slate-50 pr-6">
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase">Idea Identity</label>
                        <input className="w-full mt-1 bg-transparent font-bold text-slate-900 outline-none" placeholder="Give it a name..." />
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase">Aether Category</label>
                        <select className="w-full mt-1 bg-slate-100 rounded-lg p-2 text-xs font-bold outline-none">
                            <option>Deep Tech</option>
                            <option>Green Energy</option>
                            <option>Social Logic</option>
                        </select>
                    </div>
                </div>

                {/* Right: The Editor Surface */}
                <div className="flex-1">
                    <textarea
                        className="w-full h-full text-xl leading-relaxed text-slate-700 outline-none resize-none placeholder:text-slate-200"
                        placeholder="Start drafting the future here..."
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                    />
                </div>
            </div>
        </div>
    );
}

function ToolbarButton({ icon, label }: { icon: React.ReactNode, label: string }) {
    return (
        <button title={label} className="p-2 text-slate-500 hover:bg-white hover:text-blue-600 rounded-lg transition-all hover:shadow-sm">
            {icon}
        </button>
    );
}