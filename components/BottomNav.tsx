"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Compass, FlaskConical, Bell, User } from "lucide-react";

interface Props {
  unreadCount: number;
  userHandle:  string;
}

const NO_BOTTOM_NAV_PREFIXES = ["/sign-in", "/sign-up", "/onboarding"];

const TABS = [
  { id: "feed",          href: "/feed",          Icon: Home,          label: "Feed" },
  { id: "explore",       href: "/explore",        Icon: Compass,       label: "Explore" },
  { id: "lab",           href: "/ai-lab",         Icon: FlaskConical,  label: "Lab" },
  { id: "notifications", href: "/notifications",  Icon: Bell,          label: "Inbox" },
  { id: "profile",       href: "",                Icon: User,          label: "You" },
] as const;

function isActive(pathname: string, tabId: string, _href: string): boolean {
  if (tabId === "feed")          return pathname === "/feed" || pathname.startsWith("/idea");
  if (tabId === "explore")       return pathname.startsWith("/explore");
  if (tabId === "lab")           return pathname.startsWith("/ai-lab");
  if (tabId === "notifications") return pathname === "/notifications";
  if (tabId === "profile")       return pathname.startsWith("/profile");
  return false;
}

export default function BottomNav({ unreadCount, userHandle }: Props) {
  const pathname = usePathname();

  // Don't render on auth/onboarding/landing pages — same guard as Sidebar
  if (pathname === "/" || NO_BOTTOM_NAV_PREFIXES.some((p) => pathname.startsWith(p))) return null;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40
      bg-ic-card border-t border-ic-rule
      pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around px-2 h-14">
        {TABS.map(({ id, href, Icon, label }) => {
          const resolvedHref = id === "profile"
            ? (userHandle ? `/profile/${userHandle}` : "/sign-in")
            : href;

          const active = isActive(pathname, id, resolvedHref);

          return (
            <Link
              key={id}
              href={resolvedHref}
              className={`relative flex flex-col items-center justify-center gap-0.5 flex-1 h-14 min-w-0 transition-colors ${
                active ? "text-ic-accent" : "text-ic-muted hover:text-ic-ink-soft"
              }`}
              aria-label={id === "notifications" && unreadCount > 0 ? `${label}, ${unreadCount} unread` : label}
            >
              <Icon size={22} />
              {/* Unread dot on notifications tab */}
              {id === "notifications" && unreadCount > 0 && (
                <span className="absolute top-2 right-[calc(50%-8px)] w-2 h-2 rounded-full bg-ic-accent-bright" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
