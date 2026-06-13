"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { bindTokenGetter } from "@/lib/api";

/** Wires the NextAuth session's API token into the axios instance. */
export function ApiAuthBridge({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  useEffect(() => {
    bindTokenGetter(async () => {
      if (status !== "authenticated" || !session) return null;
      return session.apiToken ?? null;
    });
  }, [session, status]);
  return <>{children}</>;
}
