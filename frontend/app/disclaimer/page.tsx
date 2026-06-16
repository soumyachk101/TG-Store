import Link from "next/link";
import { ArrowLeft, AlertTriangle } from "lucide-react";

export default function DisclaimerPage() {
  return (
    <div className="relative min-h-screen bg-bg text-ink overflow-x-hidden flex flex-col font-sans">
      {/* Background ambient glow blurs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-accent/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-purple-500/5 blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 w-full max-w-7xl mx-auto flex h-16 items-center justify-between px-6 border-b border-line/50">
        <Link href="/" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity">
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
        </Link>

        <Link
          href="/"
          className="group flex items-center gap-1.5 rounded-full border border-line bg-bg-raised/40 hover:bg-bg-raised/70 text-ink-muted hover:text-ink text-xs font-semibold px-4 py-2 transition-all active:scale-95 duration-100"
        >
          <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
          <span>Back to Home</span>
        </Link>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 w-full max-w-4xl mx-auto px-6 py-12">
        <div className="mb-10 text-center sm:text-left">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-ink flex flex-col sm:flex-row items-center gap-3 justify-center sm:justify-start">
            <AlertTriangle className="h-8 w-8 text-amber-500 shrink-0" />
            <span>Disclaimer</span>
          </h1>
          <p className="mt-2 text-xs text-ink-muted">
            Last Updated: June 16, 2026
          </p>
        </div>

        <div className="space-y-8 text-sm text-ink-muted leading-relaxed">
          <section className="bg-bg-raised/20 border border-line p-6 rounded-2xl">
            <h2 className="text-base font-semibold text-ink mb-3">1. No Affiliation with Telegram</h2>
            <p>
              TGStore is an independent, open-source project. It is **not** affiliated, associated, authorized, endorsed by, or in any way officially connected with Telegram FZ-LLC, Telegram Messenger LLP, or any of their subsidiaries or affiliates. The official Telegram website can be found at <a href="https://telegram.org" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">telegram.org</a>. The name &quot;Telegram&quot; as well as related names, marks, emblems, and images are registered trademarks of their respective owners.
            </p>
          </section>

          <section className="bg-bg-raised/20 border border-line p-6 rounded-2xl">
            <h2 className="text-base font-semibold text-ink mb-3">2. As-Is Software & No Liability</h2>
            <p>
              This software is provided &quot;as is&quot;, without warranty of any kind, express or implied, including but not limited to the warranties of merchantability, fitness for a particular purpose, and non-infringement. In no event shall the author or copyright holders (including Soumya Chakraborty) be liable for any claim, damages, or other liability, whether in an action of contract, tort, or otherwise, arising from, out of, or in connection with the software or the use or other dealings in the software.
            </p>
          </section>

          <section className="bg-bg-raised/20 border border-line p-6 rounded-2xl">
            <h2 className="text-base font-semibold text-ink mb-3">3. Risks of Data Loss and Account Suspension</h2>
            <p>
              TGStore uses Telegram&apos;s infrastructure as a CDN to store binary payloads. Since this utilizes Telegram&apos;s bot API channels and servers, you acknowledge and agree that:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1.5 text-xs">
              <li>Telegram FZ-LLC may at any time restrict, modify, suspend, or terminate access to their Bot API or user accounts violating rate limits or guidelines.</li>
              <li>Files stored on Telegram chats are subject to Telegram&apos;s own file retention policies and storage rules.</li>
              <li>You should **not** rely on TGStore as your primary, sole backup solution for mission-critical or sensitive data. Always maintain alternative independent backups.</li>
            </ul>
          </section>

          <section className="bg-bg-raised/20 border border-line p-6 rounded-2xl">
            <h2 className="text-base font-semibold text-ink mb-3">4. Content Responsibility</h2>
            <p>
              The deployer and users of this self-hosted application are solely responsible for all content uploaded, linked, or shared using this tool. The creator of TGStore does not monitor, index, or have access to self-hosted instances of this application.
            </p>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full max-w-7xl mx-auto border-t border-line/30 py-6 px-6 flex flex-col sm:flex-row items-center justify-between text-xs text-ink-faint gap-4 mt-12">
        <div className="flex flex-col gap-1 items-center sm:items-start text-center sm:text-left">
          <span>© {new Date().getFullYear()} TGStore. All rights reserved.</span>
          <span>
            Developed by{" "}
            <span className="font-semibold text-accent/90 cursor-default">
              Soumya Chakraborty
            </span>
          </span>
        </div>
        <span className="flex items-center gap-1 select-none">
          Made with Next.js, FastAPI & Telegram CDN.
        </span>
      </footer>
    </div>
  );
}
