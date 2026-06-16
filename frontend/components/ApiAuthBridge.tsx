"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useQueryClient } from "@tanstack/react-query";
import { bindTokenGetter } from "@/lib/api";

/** Wires the NextAuth session's API token into the axios instance. */
export function ApiAuthBridge({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const queryClient = useQueryClient();

  useEffect(() => {
    bindTokenGetter(async () => {
      if (status !== "authenticated" || !session) return null;
      return session.apiToken ?? null;
    });
  }, [session, status]);

  useEffect(() => {
    if (status === "authenticated" && session) {
      queryClient.invalidateQueries();
    }
  }, [status, session, queryClient]);

  return <>{children}</>;
}
