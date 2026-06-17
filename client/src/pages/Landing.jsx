import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

/* ─────────────── INTERSECTION OBSERVER HOOK ─────────────── */
function useReveal() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { threshold: 0.12 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return [ref, visible];
}

function RevealBlock({ children, className = "", delay = 0 }) {
  const [ref, visible] = useReveal();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0) scale(1)" : "translateY(32px) scale(0.98)",
        transition: `opacity 0.85s cubic-bezier(0.32,0.72,0,1) ${delay}ms, transform 0.85s cubic-bezier(0.32,0.72,0,1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

/* ─────────────── NAV ─────────────── */
function Nav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-5 px-4 pointer-events-none">
      <nav
        style={{
          background: scrolled ? "rgba(8,8,8,0.85)" : "rgba(8,8,8,0.0)",
          backdropFilter: scrolled ? "blur(24px)" : "none",
          border: scrolled ? "1px solid rgba(255,255,255,0.08)" : "1px solid transparent",
          transition: "all 0.6s cubic-bezier(0.32,0.72,0,1)",
        }}
        className="pointer-events-auto w-full max-w-5xl flex items-center justify-between px-6 py-3 rounded-full"
      >
        <span className="font-heading text-xl text-white italic">SuperBrain</span>
        <div className="flex items-center gap-2">
          <Link to="/login">
            <button className="px-5 py-2 text-[13px] font-medium text-white/60 hover:text-white rounded-full hover:bg-white/5 transition-all duration-300">
              Sign in
            </button>
          </Link>
          <Link to="/register">
            <button className="group flex items-center gap-2 px-5 py-2.5 text-[13px] font-medium bg-white text-black rounded-full hover:bg-emerald-50 transition-all duration-300 active:scale-[0.97]">
              Get Started
              <span className="w-5 h-5 rounded-full bg-black/8 flex items-center justify-center group-hover:translate-x-0.5 group-hover:-translate-y-px transition-transform duration-300">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 8L8 2M8 2H3M8 2V7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </span>
            </button>
          </Link>
        </div>
      </nav>
    </header>
  );
}

/* ─────────────── HERO ─────────────── */
function Hero() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setTimeout(() => setMounted(true), 100); }, []);

  return (
    <section className="relative min-h-[100dvh] flex flex-col items-center justify-center overflow-hidden bg-[#080808] px-4 text-center">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-emerald-500/[0.06] blur-[120px]" />
        <div className="absolute top-1/4 left-1/4 w-[300px] h-[300px] rounded-full bg-emerald-400/[0.04] blur-[80px]" />
        {/* Film grain */}
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")", backgroundSize: "128px" }}
        />
      </div>

      {/* Eyebrow */}
      <div
        style={{ opacity: mounted ? 1 : 0, transform: mounted ? "translateY(0)" : "translateY(16px)", transition: "all 0.7s cubic-bezier(0.32,0.72,0,1) 100ms" }}
        className="mb-8 inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/10 bg-white/[0.04] text-[11px] font-medium tracking-[0.2em] uppercase text-white/50"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        AI-Powered Knowledge System
      </div>

      {/* Main heading */}
      <h1
        style={{ opacity: mounted ? 1 : 0, transform: mounted ? "translateY(0)" : "translateY(24px)", transition: "all 0.9s cubic-bezier(0.32,0.72,0,1) 200ms" }}
        className="font-heading text-[clamp(3.5rem,10vw,8rem)] leading-[0.9] tracking-[-0.03em] text-white mb-6 max-w-5xl"
      >
        Your Instagram reels,
        <br />
        <span className="text-emerald-400">intelligently indexed.</span>
      </h1>

      {/* Subtitle */}
      <p
        style={{ opacity: mounted ? 1 : 0, transform: mounted ? "translateY(0)" : "translateY(20px)", transition: "all 0.9s cubic-bezier(0.32,0.72,0,1) 380ms" }}
        className="max-w-xl text-[clamp(1rem,2.5vw,1.2rem)] text-white/40 leading-relaxed mb-12 font-body"
      >
        SuperBrain transforms every saved reel into a searchable knowledge base. Transcripts, AI summaries, semantic search — your feed becomes your second brain.
      </p>

      {/* CTAs */}
      <div
        style={{ opacity: mounted ? 1 : 0, transform: mounted ? "translateY(0)" : "translateY(16px)", transition: "all 0.9s cubic-bezier(0.32,0.72,0,1) 500ms" }}
        className="flex flex-col sm:flex-row items-center gap-3"
      >
        <Link to="/register">
          <button className="group flex items-center gap-3 px-7 py-4 bg-white text-black text-[15px] font-semibold rounded-full hover:bg-emerald-50 active:scale-[0.97] transition-all duration-300 shadow-[0_0_60px_rgba(52,211,153,0.15)]">
            Start for free
            <span className="w-7 h-7 rounded-full bg-black/8 flex items-center justify-center group-hover:translate-x-0.5 group-hover:-translate-y-px transition-transform duration-300">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 10L10 2M10 2H3.5M10 2V8.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </span>
          </button>
        </Link>
        <Link to="/login">
          <button className="px-7 py-4 text-[15px] font-medium text-white/50 hover:text-white rounded-full border border-white/10 hover:border-white/20 hover:bg-white/[0.04] transition-all duration-300">
            Sign in →
          </button>
        </Link>
      </div>

      {/* Scroll indicator */}
      <div
        style={{ opacity: mounted ? 1 : 0, transition: "opacity 1s ease 1.2s" }}
        className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
      >
        <span className="text-[10px] tracking-[0.25em] uppercase text-white/20 font-body">Scroll</span>
        <div className="w-px h-10 bg-gradient-to-b from-white/20 to-transparent" />
      </div>
    </section>
  );
}

/* ─────────────── MARQUEE STRIP ─────────────── */
function MarqueeStrip() {
  const items = ["Transcript AI", "Semantic Search", "Mind Maps", "RAG Chat", "Resource Extraction", "Vector Embeddings", "Auto Summary", "Knowledge Base"];
  return (
    <div className="bg-[#0d0d0d] border-y border-white/[0.06] py-5 overflow-hidden">
      <div className="flex animate-[marquee_28s_linear_infinite] whitespace-nowrap">
        {[...items, ...items].map((item, i) => (
          <span key={i} className="inline-flex items-center gap-4 mx-8 text-[13px] font-medium tracking-[0.12em] uppercase text-white/25">
            {item}
            <span className="w-1 h-1 rounded-full bg-emerald-500/50" />
          </span>
        ))}
      </div>
      <style>{`@keyframes marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }`}</style>
    </div>
  );
}

/* ─────────────── BENTO FEATURES ─────────────── */
const features = [
  {
    icon: "🧠",
    title: "AI Transcription",
    desc: "Every reel is automatically transcribed using Whisper-grade models. Audio to searchable text in seconds.",
    span: "col-span-1 md:col-span-2 row-span-1",
    accent: "emerald",
  },
  {
    icon: "🔍",
    title: "Semantic Search",
    desc: "Don't search by keywords — search by meaning. Ask anything and find the right reel instantly.",
    span: "col-span-1 row-span-1",
    accent: "sky",
  },
  {
    icon: "💬",
    title: "SuperBrain AI Chat",
    desc: "Chat with your entire saved library. Ask follow-up questions, get step-by-step guides extracted directly from your saves.",
    span: "col-span-1 row-span-2",
    accent: "violet",
  },
  {
    icon: "🗺️",
    title: "Mind Maps",
    desc: "Auto-generate visual knowledge maps from any saved reel.",
    span: "col-span-1 row-span-1",
    accent: "amber",
  },
  {
    icon: "🔗",
    title: "Resource Extraction",
    desc: "Every tool, website, and link mentioned in a video is automatically extracted and verified.",
    span: "col-span-1 md:col-span-2 row-span-1",
    accent: "rose",
  },
];

const accentMap = {
  emerald: { border: "rgba(52,211,153,0.15)", glow: "rgba(52,211,153,0.08)", icon: "#34d399" },
  sky: { border: "rgba(56,189,248,0.15)", glow: "rgba(56,189,248,0.08)", icon: "#38bdf8" },
  violet: { border: "rgba(167,139,250,0.15)", glow: "rgba(167,139,250,0.08)", icon: "#a78bfa" },
  amber: { border: "rgba(251,191,36,0.15)", glow: "rgba(251,191,36,0.08)", icon: "#fbbf24" },
  rose: { border: "rgba(251,113,133,0.15)", glow: "rgba(251,113,133,0.08)", icon: "#fb7185" },
};

function FeatureCard({ feature, delay }) {
  const colors = accentMap[feature.accent];
  return (
    <RevealBlock delay={delay} className={feature.span}>
      {/* Double-bezel outer shell */}
      <div
        className="h-full p-[1.5px] rounded-[1.75rem]"
        style={{ background: `linear-gradient(135deg, ${colors.border}, rgba(255,255,255,0.04))` }}
      >
        {/* Inner core */}
        <div
          className="h-full rounded-[calc(1.75rem-1.5px)] p-7 flex flex-col gap-4 relative overflow-hidden"
          style={{ background: `linear-gradient(135deg, #111111, #0d0d0d)`, boxShadow: `inset 0 1px 1px rgba(255,255,255,0.05)` }}
        >
          {/* Accent glow */}
          <div className="absolute top-0 right-0 w-48 h-48 rounded-full blur-[60px] pointer-events-none" style={{ background: colors.glow }} />
          <span className="text-3xl">{feature.icon}</span>
          <div>
            <h3 className="font-heading text-2xl text-white mb-2">{feature.title}</h3>
            <p className="font-body text-[14px] text-white/40 leading-relaxed">{feature.desc}</p>
          </div>
        </div>
      </div>
    </RevealBlock>
  );
}

function Features() {
  return (
    <section className="bg-[#080808] py-36 px-4">
      <div className="max-w-5xl mx-auto">
        <RevealBlock className="text-center mb-20">
          <span className="inline-block px-4 py-1.5 rounded-full border border-white/10 bg-white/[0.04] text-[10px] tracking-[0.2em] uppercase text-white/40 mb-6">Capabilities</span>
          <h2 className="font-heading text-[clamp(2.5rem,6vw,4.5rem)] text-white leading-tight">
            Everything your feed<br />was meant to be
          </h2>
        </RevealBlock>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 auto-rows-[220px] md:auto-rows-[200px]">
          {features.map((f, i) => (
            <FeatureCard key={f.title} feature={f} delay={i * 80} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────── HOW IT WORKS ─────────────── */
const steps = [
  { num: "01", title: "Paste any Instagram URL", desc: "Reel, post, carousel — SuperBrain accepts them all." },
  { num: "02", title: "AI processes it automatically", desc: "Audio is transcribed, video is analyzed, metadata is extracted. All in under 60 seconds." },
  { num: "03", title: "Your knowledge base grows", desc: "Every save is embedded into your personal vector database, instantly searchable." },
  { num: "04", title: "Ask anything, get answers", desc: "Use the SuperBrain AI chat to query your entire library in natural language." },
];

function HowItWorks() {
  return (
    <section className="bg-[#F5F4F1] py-36 px-4">
      <div className="max-w-5xl mx-auto">
        <RevealBlock className="mb-20">
          <span className="inline-block px-4 py-1.5 rounded-full border border-black/10 bg-black/[0.04] text-[10px] tracking-[0.2em] uppercase text-black/40 mb-6">How it works</span>
          <h2 className="font-heading text-[clamp(2.5rem,6vw,4.5rem)] text-[#111] leading-tight max-w-2xl">
            Four steps to a smarter library
          </h2>
        </RevealBlock>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {steps.map((step, i) => (
            <RevealBlock key={step.num} delay={i * 100}>
              {/* Double-bezel card */}
              <div className="p-[1px] rounded-[1.5rem] bg-black/[0.06] hover:bg-black/[0.1] transition-all duration-500">
                <div className="rounded-[calc(1.5rem-1px)] p-8 bg-[#F5F4F1] hover:bg-[#EFEEEB] transition-colors duration-500" style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.8)" }}>
                  <span className="font-mono text-[11px] tracking-[0.2em] text-black/30 mb-5 block">{step.num}</span>
                  <h3 className="font-heading text-[1.6rem] text-[#111] mb-3">{step.title}</h3>
                  <p className="font-body text-[14px] text-black/50 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            </RevealBlock>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────── SOCIAL PROOF / QUOTE ─────────────── */
function Quote() {
  return (
    <section className="bg-[#080808] py-40 px-4 relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-emerald-500/[0.05] blur-[100px] rounded-full" />
      </div>
      <RevealBlock className="max-w-4xl mx-auto text-center relative z-10">
        <svg className="mx-auto mb-10 opacity-20" width="48" height="36" viewBox="0 0 48 36" fill="none">
          <path d="M0 36V22.5C0 9.667 5.667 2.833 17 0l3 5C14.333 6.667 11.167 10.5 10.5 16.5H18V36H0ZM30 36V22.5C30 9.667 35.667 2.833 47 0l3 5C44.333 6.667 41.167 10.5 40.5 16.5H48V36H30Z" fill="white"/>
        </svg>
        <h2 className="font-heading text-[clamp(2rem,5vw,3.5rem)] text-white leading-[1.1] mb-10">
          "I used to lose every useful tutorial I watched. SuperBrain turned my Instagram feed into an actual knowledge system I can query like a database."
        </h2>
        <div className="flex items-center justify-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-heading text-lg">D</div>
          <div className="text-left">
            <p className="text-[13px] font-medium text-white/80">Dhruv</p>
            <p className="text-[12px] text-white/30">Founder, SuperBrain</p>
          </div>
        </div>
      </RevealBlock>
    </section>
  );
}

/* ─────────────── CTA SECTION ─────────────── */
function CTA() {
  return (
    <section className="bg-[#F5F4F1] py-40 px-4">
      <RevealBlock className="max-w-5xl mx-auto">
        {/* Double-bezel CTA card */}
        <div className="p-[1.5px] rounded-[2.5rem] bg-gradient-to-br from-black/10 to-black/5">
          <div
            className="rounded-[calc(2.5rem-1.5px)] px-10 py-20 md:py-28 text-center relative overflow-hidden"
            style={{ background: "linear-gradient(135deg, #111111 0%, #0a0a0a 100%)", boxShadow: "inset 0 1px 1px rgba(255,255,255,0.06)" }}
          >
            <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-emerald-500/[0.08] blur-[100px] rounded-full" />
            <div className="relative z-10">
              <span className="inline-block px-4 py-1.5 rounded-full border border-white/10 bg-white/[0.04] text-[10px] tracking-[0.2em] uppercase text-white/40 mb-8">Free to start</span>
              <h2 className="font-heading text-[clamp(2.5rem,7vw,5.5rem)] text-white leading-tight mb-6">
                Start building your<br />second brain today
              </h2>
              <p className="font-body text-[15px] text-white/40 max-w-md mx-auto mb-12">
                Paste your first Instagram URL and watch AI transform it into structured, searchable knowledge.
              </p>
              <Link to="/register">
                <button className="group inline-flex items-center gap-3 px-8 py-4 bg-white text-black text-[15px] font-semibold rounded-full hover:bg-emerald-50 active:scale-[0.97] transition-all duration-300 shadow-[0_0_80px_rgba(52,211,153,0.2)]">
                  Create your SuperBrain
                  <span className="w-7 h-7 rounded-full bg-black/8 flex items-center justify-center group-hover:translate-x-0.5 group-hover:-translate-y-px transition-transform duration-300">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 10L10 2M10 2H3.5M10 2V8.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </span>
                </button>
              </Link>
            </div>
          </div>
        </div>
      </RevealBlock>
    </section>
  );
}

/* ─────────────── FOOTER ─────────────── */
function Footer() {
  return (
    <footer className="bg-[#080808] border-t border-white/[0.06] py-12 px-4">
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <span className="font-heading italic text-white/40 text-xl">SuperBrain</span>
        <p className="font-body text-[12px] text-white/20 tracking-wider">© {new Date().getFullYear()} SuperBrain. All rights reserved.</p>
        <div className="flex items-center gap-6">
          <Link to="/login" className="text-[12px] text-white/30 hover:text-white/60 transition-colors font-body">Sign in</Link>
          <Link to="/register" className="text-[12px] text-white/30 hover:text-white/60 transition-colors font-body">Register</Link>
        </div>
      </div>
    </footer>
  );
}

/* ─────────────── PAGE EXPORT ─────────────── */
export default function Landing() {
  return (
    <div className="overflow-x-hidden">
      <Nav />
      <Hero />
      <MarqueeStrip />
      <Features />
      <HowItWorks />
      <Quote />
      <CTA />
      <Footer />
    </div>
  );
}
