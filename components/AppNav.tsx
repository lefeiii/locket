"use client";
import { Bell, BookOpenText, CirclePlus, Gift, UserRound } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  badge?: number;
};

export function AppNav() {
  const [profileHref, setProfileHref] = useState("/login");
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    client.auth.getUser().then(({ data }) => {
      if (!data.user) { setProfileHref("/login"); return; }
      client.from("users").select("username").eq("id", data.user.id).maybeSingle()
        .then(({ data: profile }) => {
          if (!profile?.username) return;
          setProfileHref(`/profile/${encodeURIComponent(profile.username)}`);

          // Fetch unread notification count
          client
            .from("notifications")
            .select("id", { count: "exact", head: true })
            .eq("recipient_name", profile.username)
            .is("read_at", null)
            .then(({ count }) => {
              setUnreadCount(count ?? 0);
            });
        });
    });
  }, []);

  const items: NavItem[] = [
    { href: "/", label: "Feed", icon: BookOpenText },
    { href: "/create", label: "Post", icon: CirclePlus },
    { href: "/wrapped", label: "Wrapped", icon: Gift },
    { href: "/notifications", label: "Activity", icon: Bell, badge: unreadCount },
    { href: profileHref, label: "Profile", icon: UserRound },
  ];

  return (
    <nav className="fixed bottom-3 left-1/2 z-40 w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 rounded-full border border-[#d8d3ce] bg-[#f8f8f6] p-2 shadow-lg">
      <div className="grid grid-cols-5 gap-1">
        {items.map(({ href, label, icon: Icon, badge }) => (
          <Link
            className="relative flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-full px-1 text-[10px] font-medium text-[#4b4b47] transition hover:bg-[#e1e2e6]"
            href={href}
            key={label}
          >
            <div className="relative">
              <Icon size={18} />
              {badge != null && badge > 0 && (
                <span className="absolute -right-1.5 -top-1.5 grid h-4 w-4 place-items-center rounded-full bg-[#f8c0c8] text-[9px] font-bold text-[#4b4b47]">
                  {badge > 9 ? "9+" : badge}
                </span>
              )}
            </div>
            <span>{label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}

export function BrandBar() {
  return (
    <header className="sticky top-0 z-30 border-b border-[#e1e2e6] bg-[#f8f8f6] px-4 py-3">
      <div className="mx-auto flex max-w-md items-center justify-between">
        <Link className="flex items-center gap-2" href="/">
          <span className="grid h-11 w-11 place-items-center overflow-hidden rounded-2xl bg-[#f8f8f6] shadow-lg">
            <Image
              alt="Locket logo"
              className="h-full w-full object-cover"
              height={44}
              priority
              src="/locket-logo-focused.png"
              width={44}
            />
          </span>
          <span>
            <span className="block text-lg font-medium leading-none text-[#4b4b47]">Locket</span>
            <span className="block text-[0.68rem] font-medium tracking-[0.15em] text-[#787775] italic">an absolute trainwreck</span>
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <Link
            aria-label="Notification settings"
            className="grid h-10 w-10 place-items-center rounded-full bg-[#e1e2e6] text-[#4b4b47]"
            href="/settings"
          >
            <Bell size={18} />
          </Link>
          <Link className="rounded-full bg-[#f8c0c8] px-4 py-2 text-xs font-medium text-[#4b4b47] shadow-lg" href="/create">
            Post
          </Link>
        </div>
      </div>
    </header>
  );
}
