"use client";

import { useState } from "react";
import Link from "next/link";

export default function IdeaFeed({ initialIdeas }: { initialIdeas: any[] }) {
  const [search, setSearch] = useState("");

  const filtered = initialIdeas.filter((i) =>
    i.title.toLowerCase().includes(search.toLowerCase()) ||
    i.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Search and Action Bar */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <input
            placeholder="Search your brainstorms..."
            className="w-full p-4 pl-12 rounded-2xl border border-slate-200 outline-none focus:ring-2 focus:ring-teal-500 transition-all bg-white"
            onChange={(e) => setSearch(e.target.value)}
          />
          <span className="absolute left-4 top-4 text-slate-400">🔍</span>
        </div>
        <Link
          href="/new"
          className="bg-teal-600 text-white px-8 py-4 rounded-2xl font-bold hover:bg-teal-700 shadow-lg shadow-teal-100 transition-all text-center"
        >
          + New Idea
        </Link>
      </div>

      {/* Ideas Grid */}
      <div className="grid gap-4">
        {filtered.length === 0 ? (
          <div className="p-20 border-2 border-dashed border-slate-200 rounded-3xl text-center">
            <p className="text-slate-400">No matches found for "{search}"</p>
          </div>
        ) : (
          filtered.map((idea) => (
            <Link
              href={`/idea/${idea.id}`}
              key={idea.id}
              className="block p-6 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-teal-100 transition-all group"
            >
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-teal-600 bg-teal-50 px-2.5 py-1 rounded-md">
                  {idea.category}
                </span>
                <div className="flex items-center gap-1.5 text-slate-400 text-sm">
                  <span>👁️</span>
                  <span className="font-medium">{idea.views ?? 0}</span>
                </div>
              </div>

              <h2 className="text-xl font-bold text-slate-900 mt-3 group-hover:text-teal-600 transition-colors">
                {idea.title}
              </h2>

              <p className="text-slate-500 mt-2 line-clamp-2 leading-relaxed">
                {idea.description}
              </p>

              <div className="mt-4 flex items-center text-teal-600 text-sm font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                Read full spark 
                <span className="ml-1 transform group-hover:translate-x-1 transition-transform">→</span>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}