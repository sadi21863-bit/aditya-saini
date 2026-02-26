"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutGrid,
    Database,
    User,
    Settings,
    PlusCircle,
    Zap
} from "lucide-react"; // Note: You'll need to install 'lucide-react' for icons

export default function Sidebar() {
    const pathname = usePathname();

    const menuItems = [
        { name: "The Aether", href: "/", icon: <LayoutGrid size={20} /> },
        { name: "My Vault", href: "/vault", icon: <Database size={20} /> },
        { name: "New Nova", href: "/new", icon: <PlusCircle size={20} /> },
    ];

    return (
        <aside className="fixed left-0 top-0 h-screen w-64 bg-white border-r border-slate-100 p-6 z-50 flex flex-col justify-between hidden lg:flex">
            <div>
                {/* BRANDING */}
                <div className="flex items-center gap-3 mb-10 px-2">
                    <div className="w-8 h-8 bg-gradient-to-tr from-teal-400 to-blue-600 rounded-lg flex items-center justify-center text-white">
                        <Zap size={18} fill="white" />
                    </div>
                    <span className="font-black italic tracking-tighter text-xl">NovAether</span>
                </div>

                {/* MENU */}
                <nav className="space-y-2">
                    {menuItems.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-sm transition-all ${pathname === item.href
                                    ? "bg-slate-900 text-white shadow-lg shadow-slate-200"
                                    : "text-slate-400 hover:text-slate-900 hover:bg-slate-50"
                                }`}
                        >
                            {item.icon}
                            {item.name}
                        </Link>
                    ))}
                </nav>
            </div>

            {/* USER PROFILE SECTION */}
            <div className="border-t border-slate-100 pt-6">
                <Link
                    href="/settings"
                    className="flex items-center gap-3 px-4 py-3 rounded-2xl text-slate-400 hover:text-slate-900 hover:bg-slate-50 transition-all mb-2"
                >
                    <Settings size={20} />
                    <span className="font-bold text-sm">Settings</span>
                </Link>

                <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-[1.5rem] border border-slate-100">
                    <div className="w-10 h-10 rounded-full bg-teal-100 border-2 border-white flex items-center justify-center text-teal-700 font-black text-xs">
                        JD
                    </div>
                    <div className="flex flex-col">
                        <span className="text-xs font-black text-slate-900">John Doe</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Owner</span>
                    </div>
                </div>
            </div>
        </aside>
    );
}