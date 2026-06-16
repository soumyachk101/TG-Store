"use client";

import { Search, LogOut, X } from "lucide-react";
import { signOut, useSession } from "next-auth/react";

interface TopBarProps {
  search: string;
  onSearch: (s: string) => void;
}

export function TopBar({ search, onSearch }: TopBarProps) {
  const { data: session } = useSession();

  const userInitial = session?.user?.name
    ? session.user.name.charAt(0).toUpperCase()
    : "U";

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-bg/95 px-4 backdrop-blur transition-all">
        {/* Left Side: Brand Logo and Title */}
        <div className="flex items-center gap-2.5">
          {/* Custom colorful Drive-like TGStore triangle logo */}
          <svg
            viewBox="0 0 24 24"
            className="h-6.5 w-6.5 drop-shadow-sm select-none"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M8.5 4.5L2 15.5H15L8.5 4.5Z"
              fill="url(#gradient1)"
            />
            <path
              d="M15.5 8.5L9 19.5H22L15.5 8.5Z"
              fill="url(#gradient2)"
            />
            <path
              d="M12 2L5.5 13H18.5L12 2Z"
              fill="url(#gradient3)"
              opacity="0.85"
            />
            <defs>
              <linearGradient id="gradient1" x1="2" y1="10" x2="15" y2="10" gradientUnits="userSpaceOnUse">
                <stop stopColor="#3b82f6" />
                <stop offset="1" stopColor="#60a5fa" />
              </linearGradient>
              <linearGradient id="gradient2" x1="9" y1="14" x2="22" y2="14" gradientUnits="userSpaceOnUse">
                <stop stopColor="#10b981" />
                <stop offset="1" stopColor="#34d399" />
              </linearGradient>
              <linearGradient id="gradient3" x1="5.5" y1="7.5" x2="18.5" y2="7.5" gradientUnits="userSpaceOnUse">
                <stop stopColor="#8b5cf6" />
                <stop offset="1" stopColor="#a78bfa" />
              </linearGradient>
            </defs>
          </svg>
          <span className="text-base font-semibold tracking-tight text-ink select-none font-sans">
            TGStore
          </span>
        </div>

        {/* Center: Search Bar */}
        <div className="relative flex-1 max-w-2xl mx-8 hidden sm:block">
          <div className="flex items-center w-full rounded-full bg-bg-subtle border border-line px-4 py-2 shadow-sm transition-all focus-within:bg-bg-raised focus-within:border-accent focus-within:shadow-md focus-within:ring-1 focus-within:ring-accent/20">
            <Search className="h-4.5 w-4.5 text-ink-faint shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              placeholder="Search in TGStore..."
              className="w-full bg-transparent pl-3 pr-2 text-sm text-ink placeholder:text-ink-faint focus:outline-none"
            />
            {search && (
              <button
                onClick={() => onSearch("")}
                className="rounded-full p-1 text-ink-muted hover:bg-bg-subtle hover:text-ink active:scale-95 transition-all"
                title="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Right Side: Profile / Actions */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div
              className="h-8 w-8 rounded-full bg-accent/20 border border-accent/30 text-accent font-semibold text-sm flex items-center justify-center shadow-inner cursor-default"
              title={session?.user?.name || "User"}
            >
              {userInitial}
            </div>
            <span className="hidden text-xs font-medium text-ink-muted lg:inline select-none">
              {session?.user?.name ?? ""}
            </span>
          </div>

          <div className="h-4 w-px bg-line" />

          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="rounded-full p-2 text-ink-muted hover:bg-bg-subtle hover:text-ink active:scale-95 transition-all"
            title="Sign out"
          >
            <LogOut className="h-4.5 w-4.5" />
          </button>
        </div>
    </header>
  );
}
