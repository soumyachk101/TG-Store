"use client";

import { useState } from "react";
import { Search, LogOut, FolderPlus } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFolder } from "@/lib/api";
import { ApiAuthBridge } from "./ApiAuthBridge";

interface TopBarProps {
  search: string;
  onSearch: (s: string) => void;
}

export function TopBar({ search, onSearch }: TopBarProps) {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState("");

  const create = useMutation({
    mutationFn: (name: string) => createFolder(name, null),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["folders"] }),
  });

  return (
    <ApiAuthBridge>
      <header className="sticky top-0 z-30 flex h-12 items-center gap-3 border-b border-line bg-bg/95 px-4 backdrop-blur">
        <div className="text-sm font-semibold tracking-tight text-ink">TGStore</div>

        <div className="relative ml-2 max-w-md flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
          <input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search files…"
            className="w-full rounded-md border border-line bg-bg-subtle py-1.5 pl-8 pr-3 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
            onKeyDown={(e) => {
              if (e.key === "/" || e.key === "f") {
                /* F shortcut handled at layout level */
              }
            }}
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          {creating ? (
            <div className="flex items-center gap-1">
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && draft.trim()) {
                    create.mutate(draft.trim());
                    setDraft("");
                    setCreating(false);
                  }
                  if (e.key === "Escape") {
                    setDraft("");
                    setCreating(false);
                  }
                }}
                placeholder="Folder name"
                className="w-40 rounded-md border border-line bg-bg-subtle px-2 py-1 text-sm focus:border-accent focus:outline-none"
              />
            </div>
          ) : (
            <button
              onClick={() => setCreating(true)}
              className="inline-flex items-center gap-1 rounded-md border border-line bg-bg-subtle px-2 py-1 text-xs text-ink-muted hover:text-ink"
              title="New folder (N)"
            >
              <FolderPlus className="h-3.5 w-3.5" />
              New folder
            </button>
          )}

          <span className="hidden text-xs text-ink-muted md:inline">
            {session?.user?.name ?? ""}
          </span>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="rounded-md p-1.5 text-ink-muted hover:bg-bg-subtle hover:text-ink"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>
    </ApiAuthBridge>
  );
}
