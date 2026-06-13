"use client";

import { Suspense, useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") ?? "/";
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (search.get("expired")) setError("Session expired. Please sign in again.");
  }, [search]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const r = await signIn("credentials", {
        username,
        password,
        redirect: false,
      });
      if (r?.error) {
        setError("Invalid credentials");
        return;
      }
      router.push(next);
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="w-full max-w-sm rounded-xl border border-line bg-bg-subtle p-6 shadow-2xl shadow-black/40"
    >
      <h1 className="text-xl font-semibold tracking-tight">TGStore</h1>
      <p className="mt-1 text-sm text-ink-muted">Sign in to access your storage</p>

      <label className="mt-6 block text-sm">
        <span className="text-ink-muted">Username</span>
        <input
          autoFocus
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="mt-1 block w-full rounded-md border border-line bg-bg-raised px-3 py-2 text-ink outline-none focus:border-accent"
          autoComplete="username"
          spellCheck={false}
        />
      </label>

      <label className="mt-3 block text-sm">
        <span className="text-ink-muted">Password</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 block w-full rounded-md border border-line bg-bg-raised px-3 py-2 text-ink outline-none focus:border-accent"
          autoComplete="current-password"
        />
      </label>

      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending || !username || !password}
        className="mt-5 w-full rounded-md bg-accent px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-bg px-4">
      <Suspense fallback={<div className="text-sm text-ink-muted">Loading…</div>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
