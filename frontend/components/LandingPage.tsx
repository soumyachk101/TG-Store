"use client";

import { HardDrive, ShieldCheck, Zap, ArrowRight, Github, Database, Network, Cloud } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="relative min-h-screen bg-bg text-ink overflow-x-hidden flex flex-col font-sans select-none">
      {/* Background ambient glow blurs & Dot Pattern */}
      <div className="fixed inset-0 bg-dot-pattern opacity-30 [mask-image:radial-gradient(ellipse_at_top,black,transparent_80%)] pointer-events-none" />
      <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-accent/15 blur-[120px] pointer-events-none animate-float" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-purple-500/10 blur-[120px] pointer-events-none animate-float-delayed" />

      {/* Top Navigation */}
      <header
        className={`fixed top-0 w-full z-50 transition-all duration-300 ease-out-expo ${
          scrolled ? "bg-bg/70 backdrop-blur-md border-b border-line/50 shadow-sm py-3" : "bg-transparent border-transparent py-5"
        }`}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6">
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
            <span className="text-lg font-bold tracking-tight text-ink">TGStore</span>
          </div>

          <Link
            href="/login"
            className="rounded-full bg-accent hover:bg-accent-hover text-white text-xs font-semibold px-6 py-2.5 shadow-md hover:shadow-lg transition-[transform,background-color] ease-out-expo duration-150 active:scale-[0.97]"
          >
            Sign In
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 flex flex-col items-center pt-32 pb-16 px-6 max-w-6xl mx-auto w-full">
        
        {/* Hero Section */}
        <section className="flex flex-col items-center text-center animate-fade-in-up w-full mt-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-4 py-1.5 text-xs text-accent font-medium mb-8 shadow-inner">
            <span className="flex h-2 w-2 rounded-full bg-accent animate-ping" />
            Self-Hosted Cloud Architecture
          </div>

          <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tight text-ink leading-[1.1] select-none max-w-4xl">
            Unlimited Cloud Storage.
            <span className="block mt-2 bg-clip-text text-transparent bg-gradient-to-r from-accent via-teal-400 to-purple-400">
              Powered by Telegram.
            </span>
          </h1>

          <p className="mt-8 text-base sm:text-lg text-ink-muted leading-relaxed max-w-2xl font-medium">
            A high-performance personal drive that utilizes Telegram&apos;s infrastructure as a free, secure, and unlimited CDN backend. Wrapped in a beautiful, responsive interface.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center gap-4">
            <Link
              href="/login"
              className="group flex items-center gap-2 rounded-full bg-accent hover:bg-accent-hover text-white text-sm font-semibold px-8 py-4 shadow-lg shadow-accent/20 transition-[transform,background-color] ease-out-expo duration-150 active:scale-[0.97]"
            >
              <span>Get Started For Free</span>
              <ArrowRight className="h-4.5 w-4.5 transition-transform group-hover:translate-x-1" />
            </Link>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-2 rounded-full border border-line bg-bg-raised/40 hover:bg-bg-raised/70 text-ink-muted hover:text-ink text-sm font-semibold px-8 py-4 transition-[transform,background-color,border-color,color] ease-out-expo duration-150 active:scale-[0.97]"
            >
              <Github className="h-4.5 w-4.5" />
              <span>View Source</span>
            </a>
          </div>
        </section>

        {/* Abstract UI Mockup (Floating) */}
        <section className="w-full max-w-4xl mt-20 relative animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
          <div className="relative w-full aspect-[16/9] rounded-2xl border border-line/60 bg-bg-raised/30 backdrop-blur-sm overflow-hidden shadow-2xl flex flex-col">
            {/* Fake Mac Header */}
            <div className="h-10 border-b border-line/50 bg-bg-raised/50 flex items-center px-4 gap-2">
              <div className="w-3 h-3 rounded-full bg-danger/80"></div>
              <div className="w-3 h-3 rounded-full bg-accent/80"></div>
              <div className="w-3 h-3 rounded-full bg-success/80"></div>
            </div>
            {/* Fake Dashboard Layout */}
            <div className="flex-1 flex p-4 gap-4 opacity-70">
              <div className="w-48 rounded-xl bg-bg-subtle border border-line/40 hidden md:block"></div>
              <div className="flex-1 flex flex-col gap-4">
                <div className="h-12 rounded-xl bg-bg-subtle border border-line/40 flex items-center px-4">
                  <div className="w-1/3 h-4 rounded bg-line/80"></div>
                </div>
                <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[1,2,3,4,5,6,7,8].map(i => (
                    <div key={i} className="rounded-xl bg-bg-subtle border border-line/40"></div>
                  ))}
                </div>
              </div>
            </div>
            {/* Gradient Overlay for Fade out effect */}
            <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/40 to-transparent"></div>
          </div>
        </section>

        {/* How it Works / Tech Stack */}
        <section className="w-full mt-32 mb-10 text-center animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
          <h2 className="text-sm font-bold tracking-widest text-accent uppercase mb-12">Architecture & Stack</h2>
          <div className="flex flex-wrap justify-center gap-6 max-w-3xl mx-auto">
            <div className="flex items-center gap-3 px-5 py-3 rounded-2xl border border-line bg-bg-raised/30 hover:bg-bg-raised transition-colors">
              <Cloud className="h-5 w-5 text-ink-muted" />
              <span className="font-semibold text-sm">Next.js Frontend</span>
            </div>
            <ArrowRight className="h-5 w-5 text-line-strong self-center hidden sm:block" />
            <div className="flex items-center gap-3 px-5 py-3 rounded-2xl border border-line bg-bg-raised/30 hover:bg-bg-raised transition-colors">
              <Database className="h-5 w-5 text-accent" />
              <span className="font-semibold text-sm">FastAPI Backend</span>
            </div>
            <ArrowRight className="h-5 w-5 text-line-strong self-center hidden sm:block" />
            <div className="flex items-center gap-3 px-5 py-3 rounded-2xl border border-line bg-bg-raised/30 hover:bg-bg-raised transition-colors">
              <Network className="h-5 w-5 text-purple-400" />
              <span className="font-semibold text-sm">Telegram CDN</span>
            </div>
          </div>
        </section>

        {/* Feature Highlights Grid */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full mt-16 animate-fade-in-up" style={{ animationDelay: "0.4s" }}>
          <div className="group flex flex-col items-start p-8 rounded-3xl border border-line bg-bg-raised/20 hover:border-accent/40 hover:bg-bg-raised/50 transition-all duration-300 hover:-translate-y-1 active:scale-[0.97] cursor-default">
            <span className="h-12 w-12 rounded-2xl bg-accent/10 text-accent flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 ease-out-expo">
              <HardDrive className="h-6 w-6" />
            </span>
            <h3 className="text-lg font-bold text-ink">Infinite Storage</h3>
            <p className="mt-3 text-sm text-ink-muted leading-relaxed">
              Upload files up to 2 GB with zero storage caps. Your files are divided, uploaded, and indexed directly onto Telegram&apos;s robust network.
            </p>
          </div>

          <div className="group flex flex-col items-start p-8 rounded-3xl border border-line bg-bg-raised/20 hover:border-purple-500/40 hover:bg-bg-raised/50 transition-all duration-300 hover:-translate-y-1 active:scale-[0.97] cursor-default">
            <span className="h-12 w-12 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 ease-out-expo">
              <ShieldCheck className="h-6 w-6" />
            </span>
            <h3 className="text-lg font-bold text-ink">User Isolation</h3>
            <p className="mt-3 text-sm text-ink-muted leading-relaxed">
              Fully isolated accounts using Firebase Auth. Every user gets a private workspace where folders and files are indexed separately.
            </p>
          </div>

          <div className="group flex flex-col items-start p-8 rounded-3xl border border-line bg-bg-raised/20 hover:border-teal-500/40 hover:bg-bg-raised/50 transition-all duration-300 hover:-translate-y-1 active:scale-[0.97] cursor-default">
            <span className="h-12 w-12 rounded-2xl bg-teal-500/10 text-teal-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 ease-out-expo">
              <Zap className="h-6 w-6" />
            </span>
            <h3 className="text-lg font-bold text-ink">Native Previews</h3>
            <p className="mt-3 text-sm text-ink-muted leading-relaxed">
              Double-click to preview images, stream videos, read PDFs, or play audio files natively inside our high-fidelity custom media player.
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full border-t border-line/30 bg-bg-subtle/50 mt-auto">
        <div className="max-w-7xl mx-auto py-8 px-6 flex flex-col md:flex-row items-center justify-between text-xs text-ink-faint gap-6">
          <div className="flex flex-col gap-1 items-center md:items-start text-center md:text-left">
            <span className="font-semibold text-ink-muted">TGStore</span>
            <span>© {new Date().getFullYear()} All rights reserved.</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 font-medium">
            <Link href="/terms" className="hover:text-ink transition-colors duration-150">
              Terms & Conditions
            </Link>
            <Link href="/privacy" className="hover:text-ink transition-colors duration-150">
              Privacy Policy
            </Link>
          </div>

          <span className="flex items-center gap-1 select-none text-center md:text-right">
            Developed by{" "}
            <span className="font-semibold text-accent/80 hover:text-accent transition-colors cursor-default">
              Soumya Chakraborty
            </span>
          </span>
        </div>
      </footer>
    </div>
  );
}
