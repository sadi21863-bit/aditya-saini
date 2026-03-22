"use client";

import { useEffect, useState } from "react";
import Lottie from "lottie-react";

export default function LoadingScreen() {
  // #39: load animation JSON via fetch instead of static import to keep it out of the JS bundle
  const [animationData, setAnimationData] = useState<object | null>(null);

  useEffect(() => {
    fetch("/animations/paperplane.json")
      .then((res) => res.json())
      .then((data) => setAnimationData(data))
      .catch(() => setAnimationData(null));
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm">
      <div className="w-64 h-64">
        {animationData ? (
          <Lottie animationData={animationData} loop={true} />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-12 h-12 rounded-full border-4 border-teal-200 border-t-teal-600 animate-spin" />
          </div>
        )}
      </div>
      <p className="mt-4 text-teal-600 font-bold tracking-widest animate-pulse uppercase text-xs">
        Loading...
      </p>
    </div>
  );
}
