import Link from "next/link";
import {
  Users, Lightbulb, MessageSquare, Rocket,
  Globe, Lock, Sparkles, ArrowRight,
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">

      {/* ── NAVBAR ──────────────────────────────────────────────────── */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-slate-800/60">
        <span className="text-xl font-bold tracking-tight text-[#0d9488]">IdeaConnect</span>
        <div className="flex items-center gap-4">
          <Link href="/explore" className="text-sm text-slate-400 hover:text-white transition-colors">
            Explore
          </Link>
          <Link href="/sign-in" className="text-sm text-slate-400 hover:text-white transition-colors">
            Sign In
          </Link>
          <Link
            href="/sign-up"
            className="text-sm font-semibold px-4 py-2 rounded-lg bg-[#0d9488] hover:bg-teal-500 text-white transition-colors"
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* ── HERO ────────────────────────────────────────────────────── */}
      <section className="relative flex flex-col items-center text-center px-6 pt-28 pb-24 overflow-hidden">
        {/* ambient glow */}
        <div className="absolute inset-0 -z-10 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-[#0d9488]/8 rounded-full blur-[140px]" />
        </div>

        <span className="inline-flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full
          bg-[#0d9488]/10 border border-[#0d9488]/30 text-[#0d9488] uppercase tracking-widest mb-6">
          <Sparkles size={11} />
          Built for small teams
        </span>

        <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.1] max-w-4xl mb-6">
          Build Ideas<br />
          <span className="text-[#0d9488]">Together.</span>
        </h1>

        <p className="text-lg md:text-xl text-slate-400 max-w-2xl mb-10 leading-relaxed">
          IdeaConnect is where small teams brainstorm, refine, and build — in rooms designed
          for collaborative thinking. More structured than chat, simpler than a project tool.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/sign-up"
            className="px-8 py-3.5 rounded-xl bg-[#0d9488] hover:bg-teal-500 text-white
              font-bold text-base transition-all shadow-lg shadow-teal-900/30 flex items-center gap-2"
          >
            Create a Room <ArrowRight size={16} />
          </Link>
          <Link
            href="/explore"
            className="px-8 py-3.5 rounded-xl border border-slate-700 hover:border-slate-500
              text-slate-300 hover:text-white font-semibold text-base transition-all"
          >
            Explore Rooms
          </Link>
        </div>
      </section>

      {/* ── HOW IT WORKS ────────────────────────────────────────────── */}
      <section className="px-6 py-20 border-t border-slate-800/60">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-3">How It Works</h2>
          <p className="text-slate-400 text-center mb-14 max-w-xl mx-auto">
            From first idea to polished concept — in three steps.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: Users,
                step: "01",
                title: "Create a Room",
                desc: "Pick a topic, set it public or private, and invite your team. A room is a focused space for one idea thread — not a general chat.",
              },
              {
                icon: Lightbulb,
                step: "02",
                title: "Post Ideas",
                desc: "Each idea has a title, a one-sentence pitch, and a full writeup. Structured enough to be useful, simple enough to post in minutes.",
              },
              {
                icon: MessageSquare,
                step: "03",
                title: "Discuss & Refine",
                desc: "Your team sparks (upvotes) ideas they love and leaves threaded comments. The best ideas rise. Bad ones get rethought.",
              },
            ].map(({ icon: Icon, step, title, desc }) => (
              <div
                key={step}
                className="relative p-8 rounded-2xl bg-slate-900 border border-slate-800
                  hover:border-[#0d9488]/40 transition-colors"
              >
                <span className="absolute top-6 right-6 text-5xl font-black text-slate-800 select-none">
                  {step}
                </span>
                <div className="w-12 h-12 rounded-xl bg-[#0d9488]/10 flex items-center justify-center mb-5">
                  <Icon size={22} className="text-[#0d9488]" />
                </div>
                <h3 className="text-lg font-bold mb-2">{title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ────────────────────────────────────────────────── */}
      <section className="px-6 py-20 border-t border-slate-800/60">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-3">Built for how teams actually think</h2>
          <p className="text-slate-400 text-center mb-14 max-w-xl mx-auto">
            Discord is too noisy. Notion is too complex. IdeaConnect sits right in between.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {[
              {
                icon: Lock,
                title: "Private rooms",
                desc: "Keep early-stage thinking within your team. Share only when you're ready.",
              },
              {
                icon: Globe,
                title: "Public rooms",
                desc: "Make your brainstorm visible to the world. Anyone can join a public room with one click.",
              },
              {
                icon: Users,
                title: "Teams of 2–8",
                desc: "Small by design. Focused rooms work better than sprawling all-hands threads.",
              },
              {
                icon: Sparkles,
                title: "Spark the best ideas",
                desc: "Upvote ideas you love. Room owners can pin the one that captures the vision.",
              },
            ].map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="flex items-start gap-4 p-6 rounded-2xl bg-slate-900 border border-slate-800
                  hover:border-slate-700 transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-[#0d9488]/10 flex items-center justify-center shrink-0">
                  <Icon size={18} className="text-[#0d9488]" />
                </div>
                <div>
                  <h3 className="font-bold text-white mb-1">{title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PHASE 2 TEASER ──────────────────────────────────────────── */}
      <section className="px-6 py-20 border-t border-slate-800/60">
        <div className="max-w-3xl mx-auto text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#0d9488]/10 border border-[#0d9488]/20
            flex items-center justify-center mx-auto mb-6">
            <Rocket size={24} className="text-[#0d9488]" />
          </div>
          <span className="text-xs font-bold uppercase tracking-widest text-slate-500 block mb-3">
            Coming next
          </span>
          <h2 className="text-3xl font-bold mb-4">Then Ship It</h2>
          <p className="text-slate-400 text-lg leading-relaxed">
            Once your team has refined an idea, graduate it into a project — with milestones,
            open roles, and a public page to attract collaborators. Phase 2 is on the horizon.
          </p>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────── */}
      <section className="px-6 py-20 border-t border-slate-800/60">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-4">Ready to build together?</h2>
          <p className="text-slate-400 mb-8 text-lg">
            Create a room in 30 seconds. Invite your team. Start thinking.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 px-10 py-4 rounded-xl bg-[#0d9488]
                hover:bg-teal-500 text-white font-bold text-lg transition-all shadow-lg shadow-teal-900/30"
            >
              Get started free <ArrowRight size={18} />
            </Link>
            <Link
              href="/explore"
              className="inline-block px-10 py-4 rounded-xl border border-slate-700
                hover:border-slate-500 text-slate-300 hover:text-white font-semibold text-lg transition-all"
            >
              Browse rooms
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-800/60 px-8 py-8 flex items-center justify-between flex-wrap gap-4">
        <span className="text-[#0d9488] font-bold text-lg">IdeaConnect</span>
        <p className="text-slate-500 text-sm">© 2026 IdeaConnect. All rights reserved.</p>
        <div className="flex gap-6 text-sm text-slate-500">
          <Link href="/explore" className="hover:text-white transition-colors">Explore</Link>
          <Link href="/sign-in" className="hover:text-white transition-colors">Sign In</Link>
          <Link href="/sign-up" className="hover:text-white transition-colors">Sign Up</Link>
        </div>
      </footer>
    </div>
  );
}
