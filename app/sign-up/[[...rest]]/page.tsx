"use client";

import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Github, Chrome, Loader2 } from "lucide-react";

export default function SignUpPage() {
  const router = useRouter();

  const [name, setName]         = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [isPending, start]      = useTransition();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    start(async () => {
      const res = await fetch("/api/auth/register", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Registration failed.");
        return;
      }
      // Auto sign-in after registration
      await signIn("credentials", { email, password, redirect: false });
      router.push("/onboarding");
      router.refresh();
    });
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white">Create an account</h1>
          <p className="text-slate-400 text-sm mt-1">Join IdeaConnect for free</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          {/* OAuth buttons */}
          <button
            onClick={() => signIn("google", { callbackUrl: "/onboarding" })}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
              border border-slate-700 bg-slate-800 text-white text-sm font-medium
              hover:bg-slate-700 transition"
          >
            <Chrome size={16} /> Continue with Google
          </button>
          <button
            onClick={() => signIn("github", { callbackUrl: "/onboarding" })}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
              border border-slate-700 bg-slate-800 text-white text-sm font-medium
              hover:bg-slate-700 transition"
          >
            <Github size={16} /> Continue with GitHub
          </button>

          <div className="flex items-center gap-3 text-slate-600 text-xs">
            <div className="flex-1 h-px bg-slate-800" />
            or
            <div className="flex-1 h-px bg-slate-800" />
          </div>

          {/* Registration form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="text"
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800
                text-white text-sm placeholder:text-slate-500 focus:outline-none
                focus:border-[#0d9488] transition"
            />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800
                text-white text-sm placeholder:text-slate-500 focus:outline-none
                focus:border-[#0d9488] transition"
            />
            <input
              type="password"
              placeholder="Password (min 8 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800
                text-white text-sm placeholder:text-slate-500 focus:outline-none
                focus:border-[#0d9488] transition"
            />
            {error && <p className="text-red-400 text-xs">{error}</p>}
            <button
              type="submit"
              disabled={isPending}
              className="w-full py-2.5 rounded-xl bg-[#0d9488] text-white text-sm font-bold
                hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed transition
                flex items-center justify-center gap-2"
            >
              {isPending && <Loader2 size={14} className="animate-spin" />}
              Create Account
            </button>
          </form>
        </div>

        <p className="text-center text-slate-500 text-sm mt-4">
          Already have an account?{" "}
          <Link href="/sign-in" className="text-[#0d9488] hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
