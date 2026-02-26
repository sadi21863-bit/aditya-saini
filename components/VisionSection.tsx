import React from 'react';
import { ideas } from "@/db/schema";

type Idea = typeof ideas.$inferSelect;

export default function VisionSection({
    idea,
}: {
    idea: Idea;
}) {
    return (
        <div className="mt-8 border-t border-slate-100 pt-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900">Full Content</h3>
            </div>
            <div className="p-5 bg-blue-50/50 rounded-2xl border border-blue-100 text-slate-700 leading-relaxed">
                {idea.content ?? "No content provided."}
            </div>
        </div>
    );
}
