"use client";

import Lottie from "lottie-react";
import animationData from "@/public/animations/paperplane.json";

export default function LoadingScreen() {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm">
      <div className="w-64 h-64">
        <Lottie animationData={animationData} loop={true} />
      </div>
      <p className="mt-4 text-teal-600 font-bold tracking-widest animate-pulse uppercase text-xs">
        Loading...
      </p>
    </div>
  );
}
