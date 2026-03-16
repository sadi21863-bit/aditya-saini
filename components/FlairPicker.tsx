"use client";

import { FLAIR_OPTIONS, FlairValue } from "@/lib/flair";

interface FlairPickerProps {
    value: FlairValue | null;
    onChange: (val: FlairValue | null) => void;
}

export default function FlairPicker({ value, onChange }: FlairPickerProps) {
    return (
        <div className="flex flex-wrap gap-2">
            {FLAIR_OPTIONS.map((f) => (
                <button
                    key={f.value}
                    type="button"
                    onClick={() => onChange(value === f.value ? null : f.value)}
                    className={`text-xs font-bold px-3 py-1.5 rounded-full border transition-all
            ${value === f.value
                            ? `${f.color} ring-2 ring-offset-1 ring-current`
                            : "bg-slate-50 text-slate-400 border-slate-200 hover:border-slate-400"
                        }`}
                >
                    {f.label}
                </button>
            ))}
        </div>
    );
}
