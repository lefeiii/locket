"use client";
import { Bell, BookOpenText, CirclePlus, Gift, UserRound } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export function AppNav() {
  const [profileHref, setProfileHref] = useState("/login");

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { setProfileHref("/login"); return; }
      supabase!.from("users").select("username").eq("id", data.user.id).single()
        .then(({ data: profile }) => {
          setProfileHref(profile?.username ? `/profile/${encodeURIComponent(profile.username)}` : "/login");
        });
    });
  }, []);

  const items = [
    { href: "/", label: "Feed", icon: BookOpenText },
    { href: "/create", label: "Post", icon: CirclePlus },
    { href: "/wrapped", label: "Wrapped", icon: Gift },
    { href: profileHref, label: "Profile", icon: UserRound },
  ];

  return (
    <nav className="fixed bottom-3 left-1/2 z-40 w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 rounded-full border border-[#d8d3ce] bg-[#f8f8f6] p-2 shadow-lg">
      <div className="grid grid-cols-4 gap-1">
        {items.map(({ href, label, icon: Icon }) => (
          <Link
            className="flex min-h-12 items-center justify-center gap-2 rounded-full px-2 text-xs font-medium text-[#4b4b47] transition hover:bg-[#e1e2e6]"
            href={href}
            key={label}
          >
            <Icon size={18} />
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
            <span className="text-[0.68rem] font-medium uppercase tracking-[0.22em] text-[#787775]">Anonymous stories</span>
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
