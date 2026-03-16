import Link from "next/link";
import { PenLine, ShieldCheck, Zap, Fingerprint, ShieldOff, Shield, Lock } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">

      {/* NAVBAR */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-slate-800/60">
        <span className="text-xl font-bold tracking-tight text-[#0d9488]">IdeaConnect</span>
        <div className="flex items-center gap-4">
          <Link href="/feed" className="text-sm text-slate-400 hover:text-white transition-colors">Explore</Link>
          <Link href="/sign-in" className="text-sm text-slate-400 hover:text-white transition-colors">Sign In</Link>
          <Link href="/sign-up" className="text-sm font-semibold px-4 py-2 rounded-lg bg-[#0d9488] hover:bg-teal-500 text-white transition-colors">
            Get Started
          </Link>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative flex flex-col items-center text-center px-6 pt-28 pb-24 overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-[#0d9488]/10 rounded-full blur-[120px]" />
        </div>
        <span className="inline-flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full bg-[#0d9488]/10 border border-[#0d9488]/30 text-[#0d9488] uppercase tracking-widest mb-6">
          <Fingerprint size={12} /> Genesis-Verified Ideas
        </span>
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-tight max-w-4xl mb-6">
          Protect Your Ideas.<br />
          <span className="text-[#0d9488]">Own Your Vision.</span>
        </h1>
        <p className="text-lg md:text-xl text-slate-400 max-w-2xl mb-10 leading-relaxed">
          IdeaConnect lets creators publish, protect, and get credit for their ideas using SHA-256 Genesis Hashing and tier-based protection — before anyone else can claim them.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link href="/sign-up" className="px-8 py-3.5 rounded-xl bg-[#0d9488] hover:bg-teal-500 text-white font-bold text-base transition-all shadow-lg shadow-teal-900/40">
            Launch Your First Idea →
          </Link>
          <Link href="/feed" className="px-8 py-3.5 rounded-xl border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white font-semibold text-base transition-all">
            Explore the Feed
          </Link>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-10 mt-16">
          {[{ label: "Ideas Protected", value: "10,000+" }, { label: "Genesis Certificates", value: "8,200+" }, { label: "Creators", value: "3,500+" }].map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-3xl font-bold">{s.value}</p>
              <p className="text-sm text-slate-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="px-6 py-20 border-t border-slate-800/60">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-3">How It Works</h2>
          <p className="text-slate-400 text-center mb-14 max-w-xl mx-auto">Three simple steps to secure your intellectual property forever.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: PenLine, step: "01", title: "Write Your Idea", desc: "Draft your idea with a title, public pitch, and full content. Choose your protection level based on your tier." },
              { icon: ShieldCheck, step: "02", title: "Choose Protection Level", desc: "Set Open, Guarded, Shielded, or Vault protection. Higher tiers unlock stronger content security." },
              { icon: Zap, step: "03", title: "Launch & Get Credit", desc: "Launch publicly. Your idea receives a SHA-256 Genesis Hash — an immutable timestamp proving first publication." },
            ].map(({ icon: Icon, step, title, desc }) => (
              <div key={step} className="relative p-8 rounded-2xl bg-slate-900 border border-slate-800 hover:border-[#0d9488]/50 transition-colors">
                <span className="absolute top-6 right-6 text-5xl font-black text-slate-800 select-none">{step}</span>
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

      {/* PROTECTION TIERS */}
      <section className="px-6 py-20 border-t border-slate-800/60">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-3">Protection Tiers</h2>
          <p className="text-slate-400 text-center mb-14 max-w-xl mx-auto">Earn XP by launching ideas and getting sparks. Unlock stronger protection as you level up.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: ShieldOff, name: "Dreamer", xp: "0 XP", protection: "Open", color: "text-slate-400", bg: "bg-slate-800", border: "border-slate-700", desc: "Full public access. Anyone can read your idea." },
              { icon: Shield, name: "Visionary", xp: "500 XP", protection: "Guarded", color: "text-teal-400", bg: "bg-teal-900/40", border: "border-teal-800", desc: "First 150 chars visible. Rest requires a spark." },
              { icon: ShieldCheck, name: "Architect", xp: "2,000 XP", protection: "Shielded", color: "text-violet-400", bg: "bg-violet-900/40", border: "border-violet-800", desc: "Copy protection enabled. Select-none enforced." },
              { icon: Lock, name: "Oracle", xp: "5,000 XP", protection: "Vault", color: "text-amber-400", bg: "bg-amber-900/40", border: "border-amber-800", desc: "Full blur lock. Must spark to reveal content." },
            ].map(({ icon: Icon, name, xp, protection, color, bg, border, desc }) => (
              <div key={name} className={`p-6 rounded-2xl border ${bg} ${border} flex flex-col gap-3`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${bg}`}>
                  <Icon size={20} className={color} />
                </div>
                <div>
                  <p className={`font-bold text-base ${color}`}>{name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{xp} · {protection}</p>
                </div>
                <p className="text-slate-400 text-xs leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* GENESIS REGISTRY */}
      <section className="px-6 py-20 border-t border-slate-800/60">
        <div className="max-w-3xl mx-auto text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-900/40 border border-emerald-800 flex items-center justify-center mx-auto mb-6">
            <Fingerprint size={28} className="text-emerald-400" />
          </div>
          <h2 className="text-3xl font-bold mb-4">Genesis Registry</h2>
          <p className="text-slate-400 text-lg leading-relaxed mb-8">
            Every idea you launch receives a <strong className="text-white">SHA-256 Genesis Hash</strong> — an immutable cryptographic timestamp that proves you published first.
          </p>
          <div className="inline-block px-6 py-4 bg-emerald-950/60 border border-emerald-800 rounded-2xl font-mono text-sm text-emerald-400 break-all">
            SHA-256 · e3b0c44298fc1c149afb · Immutable · Timestamped
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-20 border-t border-slate-800/60">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-4">Ready to Protect Your Ideas?</h2>
          <p className="text-slate-400 mb-8 text-lg">Join thousands of creators who trust IdeaConnect to guard their vision.</p>
          <Link href="/sign-up" className="inline-block px-10 py-4 rounded-xl bg-[#0d9488] hover:bg-teal-500 text-white font-bold text-lg transition-all shadow-lg shadow-teal-900/40">
            Start for Free →
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-slate-800/60 px-8 py-8 flex items-center justify-between flex-wrap gap-4">
        <span className="text-[#0d9488] font-bold text-lg">IdeaConnect</span>
        <p className="text-slate-500 text-sm">© 2026 IdeaConnect. All rights reserved.</p>
        <div className="flex gap-6 text-sm text-slate-500">
          <Link href="/feed" className="hover:text-white transition-colors">Feed</Link>
          <Link href="/registry" className="hover:text-white transition-colors">Registry</Link>
          <Link href="/leaderboard" className="hover:text-white transition-colors">Leaderboard</Link>
        </div>
      </footer>
    </div>
  );
}
