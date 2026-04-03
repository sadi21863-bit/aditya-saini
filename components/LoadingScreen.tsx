"use client";

export default function LoadingScreen() {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm">
      <div className="w-12 h-12 rounded-full border-4 border-teal-900 border-t-teal-400 animate-spin" />
      <p className="mt-4 text-teal-400 font-bold tracking-widest animate-pulse uppercase text-xs">
        Loading...
      </p>
    </div>
  );
}
