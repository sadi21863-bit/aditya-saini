"use client";

export default function LoadingScreen() {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-ic-paper/80 backdrop-blur-sm">
      <div className="w-12 h-12 rounded-full border-4 border-ic-rule border-t-ic-accent animate-spin" />
      <p className="mt-4 text-ic-accent font-bold tracking-widest animate-pulse uppercase text-xs">
        Loading...
      </p>
    </div>
  );
}
