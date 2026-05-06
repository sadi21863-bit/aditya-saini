"use client";

import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Github, Chrome, Loader2 } from "lucide-react";

export default function SignInPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl  = searchParams.get("redirect_url") ?? "/feed";
  const oauthError   = searchParams.get("error");

  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState(
    oauthError === "OAuthAccountNotLinked"
      ? "This email is already registered. Sign in with your password instead."
      : ""
  );
  const [isPending, start]      = useTransition();

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    start(async () => {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (res?.error) {
        setError("Invalid email or password.");
      } else {
        router.push(redirectUrl);
        router.refresh();
      }
    });
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Welcome back</h1>
          <p className="text-gray-500 dark:text-slate-400 text-sm mt-1">Sign in to IdeaConnect</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
          {/* OAuth buttons */}
          <button
            onClick={() => signIn("google", { callbackUrl: redirectUrl })}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
              border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white text-sm font-medium
              hover:bg-gray-100 dark:hover:bg-slate-700 transition"
          >
            <Chrome size={16} /> Continue with Google
          </button>
          <button
            onClick={() => signIn("github", { callbackUrl: redirectUrl })}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
              border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white text-sm font-medium
              hover:bg-gray-100 dark:hover:bg-slate-700 transition"
          >
            <Github size={16} /> Continue with GitHub
          </button>

          <div className="flex items-center gap-3 text-gray-400 dark:text-slate-600 text-xs">
            <div className="flex-1 h-px bg-gray-200 dark:bg-slate-800" />
            or
            <div className="flex-1 h-px bg-gray-200 dark:bg-slate-800" />
          </div>

          {/* Credentials form */}
          <form onSubmit={handleCredentials} className="space-y-3">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800
                text-gray-900 dark:text-white text-sm placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:outline-none
                focus:border-[#0d9488] transition"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800
                text-gray-900 dark:text-white text-sm placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:outline-none
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
              Sign In
            </button>
          </form>
        </div>

        <p className="text-center text-gray-400 dark:text-slate-500 text-sm mt-4">
          Don&apos;t have an account?{" "}
          <Link href="/sign-up" className="text-[#0d9488] hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
