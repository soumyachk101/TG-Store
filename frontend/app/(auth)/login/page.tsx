"use client";

import { Suspense, useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth as firebaseAuth } from "@/lib/firebase";
import { Loader2 } from "lucide-react";

/**
 * Validate the post-login redirect target. Only same-origin paths are
 * acceptable: must start with `/` and must NOT be a protocol-relative URL
 * (e.g. `//evil.com`).
 */
function safeNext(raw: string | null): string {
  if (!raw) return "/";
  if (!raw.startsWith("/")) return "/";
  if (raw.startsWith("//")) return "/";
  return raw;
}

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const next = safeNext(search.get("next"));
  
  // State variables
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (search.get("expired")) setError("Session expired. Please sign in again.");
  }, [search]);

  // Reset inputs when switching tabs
  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    setPassword("");
    setConfirmPassword("");
    setError(null);
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError("Please fill in all fields.");
      return;
    }

    if (isSignUp) {
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
      if (password.length < 6) {
        setError("Password must be at least 6 characters.");
        return;
      }

      startTransition(async () => {
        if (!firebaseAuth) {
          setError("Firebase Client SDK is not initialized. Please verify your env keys.");
          return;
        }
        try {
          // 1. Create Firebase User
          await createUserWithEmailAndPassword(firebaseAuth, trimmedEmail, password);
          
          // 2. Perform local NextAuth SignIn immediately
          const r = await signIn("credentials", {
            username: trimmedEmail,
            password,
            redirect: false,
          });
          if (r?.error) {
            setError("Account created, but sign in failed. Please login manually.");
            return;
          }
          router.push(next);
          router.refresh();
        } catch (err: any) {
          setError(err.message || "Failed to create account.");
        }
      });
    } else {
      // Sign In Flow
      startTransition(async () => {
        const r = await signIn("credentials", {
          username: trimmedEmail,
          password,
          redirect: false,
        });
        if (r?.error) {
          setError("Invalid email or password.");
          return;
        }
        router.push(next);
        router.refresh();
      });
    }
  }

  return (
    <div className="w-full max-w-sm rounded-2xl border border-line bg-bg-raised p-6 shadow-2xl select-none flex flex-col gap-6">
      {/* Title Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight text-ink">TGStore</h1>
        <p className="text-xs text-ink-muted mt-1.5">
          {isSignUp ? "Create an account to get started" : "Sign in to access your storage"}
        </p>
      </div>

      {/* Tab Selectors */}
      <div className="flex border-b border-line">
        <button
          onClick={() => isSignUp && toggleMode()}
          className={`flex-1 pb-2.5 text-xs font-semibold text-center border-b-2 transition-all ${
            !isSignUp
              ? "border-accent text-accent"
              : "border-transparent text-ink-muted hover:text-ink"
          }`}
        >
          Sign In
        </button>
        <button
          onClick={() => !isSignUp && toggleMode()}
          className={`flex-1 pb-2.5 text-xs font-semibold text-center border-b-2 transition-all ${
            isSignUp
              ? "border-accent text-accent"
              : "border-transparent text-ink-muted hover:text-ink"
          }`}
        >
          Sign Up
        </button>
      </div>

      {/* Input Form */}
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <label className="block text-xs">
          <span className="text-ink-muted font-medium">Email Address</span>
          <input
            autoFocus
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1.5 block w-full rounded-lg border border-line bg-bg px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent focus:ring-1 focus:ring-accent"
            autoComplete="email"
            spellCheck={false}
            required
          />
        </label>

        <label className="block text-xs">
          <span className="text-ink-muted font-medium">Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1.5 block w-full rounded-lg border border-line bg-bg px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent focus:ring-1 focus:ring-accent"
            autoComplete={isSignUp ? "new-password" : "current-password"}
            required
          />
        </label>

        {isSignUp && (
          <label className="block text-xs">
            <span className="text-ink-muted font-medium">Confirm Password</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1.5 block w-full rounded-lg border border-line bg-bg px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent focus:ring-1 focus:ring-accent"
              autoComplete="new-password"
              required
            />
          </label>
        )}

        {error && (
          <div role="alert" className="text-xs text-danger bg-danger/10 border border-danger/30 rounded-lg p-2.5 leading-normal">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isPending || !email || !password || (isSignUp && !confirmPassword)}
          className="mt-2 w-full rounded-full bg-accent hover:bg-accent-hover text-white py-2.5 text-sm font-semibold transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-white" />
              <span>{isSignUp ? "Creating..." : "Signing in..."}</span>
            </>
          ) : (
            <span>{isSignUp ? "Register" : "Sign In"}</span>
          )}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-bg px-4 relative overflow-x-hidden overflow-y-auto py-8">
      {/* Background blurs */}
      <div className="absolute top-[-20%] left-[-20%] w-[60vw] h-[60vw] rounded-full bg-accent/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60vw] h-[60vw] rounded-full bg-purple-500/5 blur-[120px] pointer-events-none" />

      <Suspense fallback={<div className="text-sm text-ink-muted flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
