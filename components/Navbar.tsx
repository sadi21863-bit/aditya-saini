import Link from "next/link";

export default function Navbar() {
  return (
    <nav className="sticky top-0 z-50 flex justify-between items-center px-8 py-4 bg-white/90 backdrop-blur-md border-b border-slate-100 shadow-sm">
      <Link href="/feed" className="flex items-center gap-2 group">
        <span className="text-xl font-bold text-slate-900 tracking-tight" style={{ fontFamily: 'var(--font-playfair)' }}>
          Idea<span className="text-[#0d9488]">Connect</span>
        </span>
      </Link>
      <div className="flex items-center gap-6 text-sm font-medium">
        <Link href="/feed" className="text-slate-500 hover:text-[#0d9488] transition-colors">
          Feed
        </Link>
        <Link href="/dashboard" className="text-slate-500 hover:text-[#0d9488] transition-colors">
          Dashboard
        </Link>
        <Link
          href="/new"
          className="bg-[#0d9488] text-white px-5 py-2.5 rounded-full hover:bg-teal-700 transition-all shadow-sm active:scale-95 font-bold"
        >
          Post Idea
        </Link>
      </div>
    </nav>
  );
}
