"use client";

import { HardDrive, ShieldCheck, Zap, ArrowRight, Github } from "lucide-react";
import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="relative min-h-screen bg-bg text-ink overflow-x-hidden flex flex-col font-sans select-none">
      {/* Background ambient glow blurs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-accent/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-purple-500/10 blur-[120px] pointer-events-none" />

      {/* Top Navigation */}
      <header className="relative z-10 w-full max-w-7xl mx-auto flex h-16 items-center justify-between px-6 border-b border-line/50">
        <div className="flex items-center gap-2.5">
          {/* Tri-color triangle logo */}
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M8.5 4.5L2 15.5H15L8.5 4.5Z" fill="url(#landGrad1)" />
            <path d="M15.5 8.5L9 19.5H22L15.5 8.5Z" fill="url(#landGrad2)" />
            <path d="M12 2L5.5 13H18.5L12 2Z" fill="url(#landGrad3)" opacity="0.85" />
            <defs>
              <linearGradient id="landGrad1" x1="2" y1="10" x2="15" y2="10" gradientUnits="userSpaceOnUse">
                <stop stopColor="#3b82f6" />
                <stop offset="1" stopColor="#60a5fa" />
              </linearGradient>
              <linearGradient id="landGrad2" x1="9" y1="14" x2="22" y2="14" gradientUnits="userSpaceOnUse">
                <stop stopColor="#10b981" />
                <stop offset="1" stopColor="#34d399" />
              </linearGradient>
              <linearGradient id="landGrad3" x1="5.5" y1="7.5" x2="18.5" y2="7.5" gradientUnits="userSpaceOnUse">
                <stop stopColor="#8b5cf6" />
                <stop offset="1" stopColor="#a78bfa" />
              </linearGradient>
            </defs>
          </svg>
          <span className="text-base font-semibold tracking-tight text-ink">TGStore</span>
        </div>

        <Link
          href="/login"
          className="rounded-full bg-accent hover:bg-accent-hover text-white text-xs font-semibold px-5 py-2 shadow-md hover:shadow-lg transition-all active:scale-95 duration-100"
        >
          Sign In
        </Link>
      </header>

      {/* Main Hero Section */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-6 py-16 max-w-5xl mx-auto">
        <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/5 px-3 py-1 text-xs text-accent font-medium mb-6">
          <span className="flex h-2 w-2 rounded-full bg-accent animate-ping" />
          Self-Hosted Cloud Solution
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-ink leading-tight select-none">
          Unlimited Cloud Storage.
          <span className="block mt-2 bg-clip-text text-transparent bg-gradient-to-r from-accent via-teal-400 to-purple-400">
            Powered by Telegram.
          </span>
        </h1>

        <p className="mt-6 text-sm sm:text-base text-ink-muted leading-relaxed max-w-2xl">
          A personal drive system that utilizes Telegram&apos;s infrastructure as a free, secure, and unlimited CDN backend for your files, organized in a beautiful Google Drive-like interface.
        </p>

        {/* CTA Buttons */}
        <div className="mt-8 flex flex-col sm:flex-row items-center gap-4">
          <Link
            href="/login"
            className="group flex items-center gap-2 rounded-full bg-accent hover:bg-accent-hover text-white text-sm font-semibold px-7 py-3.5 shadow-lg shadow-accent/20 active:scale-95 transition-all duration-100"
          >
            <span>Get Started For Free</span>
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-full border border-line bg-bg-raised/40 hover:bg-bg-raised/70 text-ink-muted hover:text-ink text-sm font-semibold px-6 py-3.5 active:scale-95 transition-all duration-100"
          >
            <Github className="h-4.5 w-4.5" />
            <span>GitHub Repository</span>
          </a>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full mt-24">
          <div className="flex flex-col items-center p-6 rounded-2xl border border-line bg-bg-raised/20 hover:bg-bg-raised/45 transition-colors text-center">
            <span className="h-12 w-12 rounded-xl bg-accent/15 text-accent flex items-center justify-center mb-4">
              <HardDrive className="h-6 w-6" />
            </span>
            <h3 className="text-base font-semibold text-ink">Infinite Storage</h3>
            <p className="mt-2 text-xs text-ink-muted leading-relaxed">
              Upload files up to 2 GB with zero storage caps. Your files are divided, uploaded, and indexed directly onto Telegram&apos;s network.
            </p>
          </div>

          <div className="flex flex-col items-center p-6 rounded-2xl border border-line bg-bg-raised/20 hover:bg-bg-raised/45 transition-colors text-center">
            <span className="h-12 w-12 rounded-xl bg-purple-500/15 text-purple-400 flex items-center justify-center mb-4">
              <ShieldCheck className="h-6 w-6" />
            </span>
            <h3 className="text-base font-semibold text-ink">User Isolation</h3>
            <p className="mt-2 text-xs text-ink-muted leading-relaxed">
              Fully isolated accounts. Every user gets a private workspace where folders and files are indexed separately based on Firebase UIDs.
            </p>
          </div>

          <div className="flex flex-col items-center p-6 rounded-2xl border border-line bg-bg-raised/20 hover:bg-bg-raised/45 transition-colors text-center">
            <span className="h-12 w-12 rounded-xl bg-teal-500/15 text-teal-400 flex items-center justify-center mb-4">
              <Zap className="h-6 w-6" />
            </span>
            <h3 className="text-base font-semibold text-ink">Browser Previews</h3>
            <p className="mt-2 text-xs text-ink-muted leading-relaxed">
              Double-click to preview images, stream videos, read PDFs, or play audio files natively inside our high-fidelity custom media player.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full max-w-7xl mx-auto border-t border-line/30 py-6 px-6 flex flex-col sm:flex-row items-center justify-between text-xs text-ink-faint gap-4 mt-12">
        <div className="flex flex-col gap-1 items-center sm:items-start text-center sm:text-left">
          <span>© {new Date().getFullYear()} TGStore. All rights reserved.</span>
          <span>
            Developed by{" "}
            <span className="font-semibold text-accent/90 hover:text-accent transition-colors cursor-default">
              Soumya Chakraborty
            </span>
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 font-medium">
          <Link href="/terms" className="hover:text-ink transition-colors duration-150">
            Terms & Conditions
          </Link>
          <Link href="/privacy" className="hover:text-ink transition-colors duration-150">
            Privacy Policy
          </Link>
          <Link href="/disclaimer" className="hover:text-ink transition-colors duration-150">
            Disclaimer
          </Link>
        </div>

        <span className="flex items-center gap-1 select-none text-center sm:text-right">
          Made with Next.js, FastAPI & Telegram CDN.
        </span>
      </footer>
    </div>
  );
}
