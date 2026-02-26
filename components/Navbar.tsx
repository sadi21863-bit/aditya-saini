import Link from "next/link";

export default function Navbar() {
  return (
    <nav className="sticky top-0 z-50 flex justify-between items-center p-6 bg-white/90 backdrop-blur-md border-b border-teal-100 shadow-sm">
      {/* Logo - Now clickable to go Home */}
      <Link href="/" className="text-2xl font-bold text-teal-600 tracking-tight hover:opacity-80 transition-opacity">
        Idea<span className="text-teal-900">Connect</span>
      </Link>

      <div className="flex items-center space-x-6 md:space-x-8 text-sm font-medium text-slate-600">
        <Link href="/" className="hover:text-teal-500 transition-colors hidden sm:block">
          The Feed
        </Link>
        
        {/* Updated Button: Linked to your /new page */}
        <Link 
          href="/new" 
          className="bg-teal-600 text-white px-5 py-2.5 rounded-full hover:bg-teal-700 transition-all shadow-md active:scale-95 font-bold"
        >
          Post an Idea
        </Link>
      </div>
    </nav>
  );
}