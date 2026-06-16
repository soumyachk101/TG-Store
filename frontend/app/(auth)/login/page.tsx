"use client";

import { Suspense, useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, sendPasswordResetEmail } from "firebase/auth";
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
  const [success, setSuccess] = useState<string | null>(null);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (search.get("expired")) setError("Session expired. Please sign in again.");
  }, [search]);

  // Reset inputs when switching tabs
  const toggleMode = (mode: "signIn" | "signUp" | "forgotPassword") => {
    setIsSignUp(mode === "signUp");
    setIsForgotPassword(mode === "forgotPassword");
    setPassword("");
    setConfirmPassword("");
    setError(null);
    setSuccess(null);
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("Please enter your email address.");
      return;
    }

    if (isForgotPassword) {
      startTransition(async () => {
        if (!firebaseAuth) {
          setError("Firebase Client SDK is not initialized.");
          return;
        }
        try {
          await sendPasswordResetEmail(firebaseAuth, trimmedEmail);
          setSuccess("Password reset email sent! Check your inbox.");
          setIsForgotPassword(false);
          setPassword("");
        } catch (err: any) {
          setError(err.message || "Failed to send reset email.");
        }
      });
      return;
    }

    if (!password) {
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

  async function handleGoogleSignIn() {
    setError(null);
    startTransition(async () => {
      if (!firebaseAuth) {
        setError("Firebase Client SDK is not initialized.");
        return;
      }
      try {
        const provider = new GoogleAuthProvider();
        const userCredential = await signInWithPopup(firebaseAuth, provider);
        const idToken = await userCredential.user.getIdToken();
        const { uid, email, displayName } = userCredential.user;
        
        const r = await signIn("credentials", {
          idToken,
          email,
          name: displayName,
          uid,
          redirect: false,
        });

        if (r?.error) {
          setError("Google sign in failed. Please try again.");
          return;
        }
        router.push(next);
        router.refresh();
      } catch (err: any) {
        if (err.code !== "auth/popup-closed-by-user") {
          setError(err.message || "Failed to sign in with Google.");
        }
      }
    });
  }

  return (
    <div className="w-full max-w-sm select-none flex flex-col gap-6 animate-fade-in-up">
      {/* Title Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight text-ink">TGStore</h1>
        <p className="text-xs text-ink-muted mt-1.5">
          {isForgotPassword 
            ? "Reset your password" 
            : isSignUp 
              ? "Create an account to get started" 
              : "Sign in to access your storage"}
        </p>
      </div>

      {/* Tab Selectors */}
      <div className="flex border-b border-line">
        <button
          type="button"
          onClick={() => !isForgotPassword && isSignUp && toggleMode("signIn")}
          className={`flex-1 pb-2.5 text-xs font-semibold text-center border-b-2 transition-all ${
            !isSignUp && !isForgotPassword
              ? "border-accent text-accent"
              : "border-transparent text-ink-muted hover:text-ink"
          }`}
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => !isForgotPassword && !isSignUp && toggleMode("signUp")}
          className={`flex-1 pb-2.5 text-xs font-semibold text-center border-b-2 transition-all ${
            isSignUp && !isForgotPassword
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

        {!isForgotPassword && (
          <>
            <label className="block text-xs relative">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-ink-muted font-medium">Password</span>
                {!isSignUp && (
                  <button
                    type="button"
                    onClick={() => toggleMode("forgotPassword")}
                    className="text-[10px] text-accent hover:text-accent-hover transition-colors"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full rounded-lg border border-line bg-bg px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent focus:ring-1 focus:ring-accent"
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
          </>
        )}

        {error && (
          <div role="alert" className="text-xs text-danger bg-danger/10 border border-danger/30 rounded-lg p-2.5 leading-normal">
            {error}
          </div>
        )}

        {success && (
          <div role="alert" className="text-xs text-success bg-success/10 border border-success/30 rounded-lg p-2.5 leading-normal">
            {success}
          </div>
        )}

        <button
          type="submit"
          disabled={isPending || !email || (!isForgotPassword && (!password || (isSignUp && !confirmPassword)))}
          className="mt-2 w-full rounded-full bg-accent hover:bg-accent-hover text-white py-2.5 text-sm font-semibold transition-[transform,background-color] duration-150 ease-out-expo active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-white" />
              <span>{isForgotPassword ? "Sending..." : isSignUp ? "Creating..." : "Signing in..."}</span>
            </>
          ) : (
            <span>{isForgotPassword ? "Send Reset Link" : isSignUp ? "Register" : "Sign In"}</span>
          )}
        </button>

        {isForgotPassword && (
          <button
            type="button"
            onClick={() => toggleMode("signIn")}
            className="text-xs text-ink-muted hover:text-ink font-medium transition-colors"
          >
            Back to login
          </button>
        )}

        {!isForgotPassword && (
          <>
            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-line"></div>
              <span className="flex-shrink-0 px-3 text-xs text-ink-muted">or</span>
              <div className="flex-grow border-t border-line"></div>
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isPending}
              className="w-full rounded-full bg-bg-raised hover:bg-line border border-line text-ink py-2.5 text-sm font-semibold transition-[transform,background-color] duration-150 ease-out-expo active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
                <path d="M1 1h22v22H1z" fill="none" />
              </svg>
              <span>Sign in with Google</span>
            </button>
          </>
        )}
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen bg-bg overflow-hidden">
      {/* Left side: Branding / Graphic */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-bg-raised items-center justify-center overflow-hidden border-r border-line">
        <div className="absolute inset-0 bg-dot-pattern opacity-30 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)] pointer-events-none" />
        <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-accent/20 blur-[120px] pointer-events-none animate-float" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-purple-500/10 blur-[120px] pointer-events-none animate-float-delayed" />
        
        <div className="relative z-10 flex flex-col items-center text-center p-12">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-8">
            <svg viewBox="0 0 24 24" className="h-16 w-16 drop-shadow-2xl" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8.5 4.5L2 15.5H15L8.5 4.5Z" fill="url(#loginGrad1)" />
              <path d="M15.5 8.5L9 19.5H22L15.5 8.5Z" fill="url(#loginGrad2)" />
              <path d="M12 2L5.5 13H18.5L12 2Z" fill="url(#loginGrad3)" opacity="0.85" />
              <defs>
                <linearGradient id="loginGrad1" x1="2" y1="10" x2="15" y2="10" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#3b82f6" />
                  <stop offset="1" stopColor="#60a5fa" />
                </linearGradient>
                <linearGradient id="loginGrad2" x1="9" y1="14" x2="22" y2="14" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#10b981" />
                  <stop offset="1" stopColor="#34d399" />
                </linearGradient>
                <linearGradient id="loginGrad3" x1="5.5" y1="7.5" x2="18.5" y2="7.5" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#8b5cf6" />
                  <stop offset="1" stopColor="#a78bfa" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <h1 className="text-4xl font-extrabold text-ink tracking-tight mb-4">TGStore</h1>
          <p className="text-lg text-ink-muted max-w-sm font-medium">
            Your personal, unlimited cloud drive powered by Telegram CDN.
          </p>
        </div>
      </div>

      {/* Right side: Form Container */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 relative">
        {/* Mobile ambient glow */}
        <div className="absolute top-[-20%] left-[-20%] w-[60vw] h-[60vw] rounded-full bg-accent/5 blur-[120px] pointer-events-none lg:hidden" />
        <div className="absolute bottom-[-20%] right-[-20%] w-[60vw] h-[60vw] rounded-full bg-purple-500/5 blur-[120px] pointer-events-none lg:hidden" />
        
        <Suspense fallback={<div className="text-sm text-ink-muted flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
