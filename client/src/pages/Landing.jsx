import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { motion, useScroll, useTransform, useMotionValueEvent, useSpring } from "framer-motion";
import { ReactLenis } from 'lenis/react';

const easing = [0.32, 0.72, 0, 1]; // Premium cubic-bezier

/* ─────────────── REVEAL WRAPPER ─────────────── */
function RevealBlock({ children, className = "", delay = 0, yOffset = 40 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: yOffset, filter: "blur(4px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.9, ease: easing, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ─────────────── NAV ─────────────── */
function Nav() {
  const { scrollY } = useScroll();
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useMotionValueEvent(scrollY, "change", (latest) => {
    const previous = scrollY.getPrevious();
    if (latest > 100 && latest > previous) {
      setHidden(true);
    } else {
      setHidden(false);
    }
    setScrolled(latest > 40);
  });

  return (
    <motion.header
      variants={{
        visible: { y: 0, opacity: 1 },
        hidden: { y: "-100%", opacity: 0 },
      }}
      animate={hidden ? "hidden" : "visible"}
      transition={{ duration: 0.6, ease: easing }}
      className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-5 px-4 pointer-events-none"
    >
      <motion.nav
        initial={false}
        animate={{
          background: scrolled ? "rgba(8,8,8,0.85)" : "rgba(8,8,8,0.0)",
          backdropFilter: scrolled ? "blur(24px)" : "blur(0px)",
          borderColor: scrolled ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.0)",
        }}
        transition={{ duration: 0.5 }}
        className="pointer-events-auto w-full max-w-5xl flex items-center justify-between px-6 py-3 rounded-full border border-transparent"
      >
        <span className="font-heading text-xl text-white italic">SuperBrain</span>
        <div className="flex items-center gap-2">
          <Link to="/login">
            <motion.button 
              whileHover={{ backgroundColor: "rgba(255,255,255,0.05)" }}
              whileTap={{ scale: 0.97 }}
              className="px-5 py-2 text-[13px] font-medium text-white/60 hover:text-white rounded-full transition-colors duration-300"
            >
              Sign in
            </motion.button>
          </Link>
          <Link to="/register">
            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.96 }}
              className="group flex items-center gap-2 px-5 py-2.5 text-[13px] font-medium bg-white text-black rounded-full hover:bg-emerald-50 transition-colors"
            >
              Get Started
              <span className="w-5 h-5 rounded-full bg-black/8 flex items-center justify-center group-hover:translate-x-0.5 group-hover:-translate-y-px transition-transform duration-300">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 8L8 2M8 2H3M8 2V7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </span>
            </motion.button>
          </Link>
        </div>
      </motion.nav>
    </motion.header>
  );
}

/* ─────────────── HERO ─────────────── */
function Hero() {
  const { scrollY } = useScroll();
  const yText = useTransform(scrollY, [0, 800], [0, 250]);
  const opacityText = useTransform(scrollY, [0, 400], [1, 0]);
  const scaleImage = useTransform(scrollY, [0, 1000], [1, 1.15]);
  const blurBg = useTransform(scrollY, [0, 600], ["blur(120px)", "blur(180px)"]);

  const containerVars = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.15, delayChildren: 0.1 }
    }
  };

  const itemVars = {
    hidden: { opacity: 0, y: 30, filter: "blur(8px)" },
    show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 1.2, ease: easing } }
  };

  return (
    <section className="relative min-h-[100dvh] flex flex-col items-center justify-center overflow-hidden bg-[#080808] px-4 text-center">
      {/* Ambient glow */}
      <motion.div style={{ scale: scaleImage }} className="pointer-events-none absolute inset-0">
        <motion.div style={{ filter: blurBg }} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-emerald-500/[0.06]" />
        <div className="absolute top-1/4 left-1/4 w-[300px] h-[300px] rounded-full bg-emerald-400/[0.04] blur-[80px]" />
        {/* Film grain */}
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")", backgroundSize: "128px" }}
        />
      </motion.div>

      <motion.div 
        variants={containerVars} 
        initial="hidden" 
        animate="show"
        style={{ y: yText, opacity: opacityText }}
        className="relative z-10 flex flex-col items-center"
      >
        {/* Eyebrow */}
        <motion.div
          variants={itemVars}
          className="mb-8 inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/10 bg-white/[0.04] text-[11px] font-medium tracking-[0.2em] uppercase text-white/50"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          AI-Powered Knowledge System
        </motion.div>

        {/* Main heading */}
        <motion.h1
          variants={itemVars}
          className="font-heading text-[clamp(3.5rem,10vw,8rem)] leading-[0.9] tracking-[-0.03em] text-white mb-6 max-w-5xl"
        >
          Your Instagram reels,
          <br />
          <span className="text-emerald-400 inline-block">intelligently indexed.</span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          variants={itemVars}
          className="max-w-xl text-[clamp(1rem,2.5vw,1.2rem)] text-white/40 leading-relaxed mb-12 font-body"
        >
          SuperBrain transforms every saved reel into a searchable knowledge base. Transcripts, AI summaries, semantic search — your feed becomes your second brain.
        </motion.p>

        {/* CTAs */}
        <motion.div variants={itemVars} className="flex flex-col sm:flex-row items-center gap-3">
          <Link to="/register">
            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              className="group flex items-center gap-3 px-7 py-4 bg-white text-black text-[15px] font-semibold rounded-full hover:bg-emerald-50 transition-colors shadow-[0_0_60px_rgba(52,211,153,0.15)]"
            >
              Start for free
              <span className="w-7 h-7 rounded-full bg-black/8 flex items-center justify-center group-hover:translate-x-0.5 group-hover:-translate-y-px transition-transform duration-300">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 10L10 2M10 2H3.5M10 2V8.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </span>
            </motion.button>
          </Link>
          <Link to="/login">
            <motion.button 
              whileHover={{ backgroundColor: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.2)" }}
              whileTap={{ scale: 0.97 }}
              className="px-7 py-4 text-[15px] font-medium text-white/50 hover:text-white rounded-full border border-white/10 bg-white/[0.02] transition-colors"
            >
              Sign in →
            </motion.button>
          </Link>
        </motion.div>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5, duration: 1 }}
        className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
      >
        <span className="text-[10px] tracking-[0.25em] uppercase text-white/20 font-body">Scroll</span>
        <motion.div 
          animate={{ height: ["0px", "40px", "40px"], y: [0, 0, 40], opacity: [0, 1, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="w-px bg-gradient-to-b from-white/40 to-transparent origin-top" 
        />
      </motion.div>
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
          <span key={i} className="inline-flex items-center gap-6 mx-8 text-[13px] font-medium tracking-[0.12em] uppercase text-white/25">
            {item}
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-emerald-500/60">
              <path d="M7 0L8.2 5.8L14 7L8.2 8.2L7 14L5.8 8.2L0 7L5.8 5.8L7 0Z" fill="currentColor" />
            </svg>
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
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v18M8 8v8M16 8v8M4 11v2M20 11v2"/></svg>,
    title: "AI Transcription",
    desc: "Every reel is automatically transcribed using Whisper-grade models. Audio to searchable text in seconds.",
    span: "col-span-1 md:col-span-2 row-span-1",
    accent: "emerald",
  },
  {
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="6"/><path d="M20 20l-4-4"/></svg>,
    title: "Semantic Search",
    desc: "Don't search by keywords — search by meaning. Ask anything and find the right reel instantly.",
    span: "col-span-1 row-span-1",
    accent: "sky",
  },
  {
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>,
    title: "SuperBrain AI Chat",
    desc: "Chat with your entire saved library. Ask follow-up questions, get step-by-step guides extracted directly from your saves.",
    span: "col-span-1 row-span-2",
    accent: "violet",
  },
  {
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="5" r="3"/><circle cx="6" cy="19" r="3"/><circle cx="18" cy="19" r="3"/><path d="M10.5 7.5l-3 8.5M13.5 7.5l3 8.5M7.5 19h9"/></svg>,
    title: "Mind Maps",
    desc: "Auto-generate visual knowledge maps from any saved reel.",
    span: "col-span-1 row-span-1",
    accent: "amber",
  },
  {
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>,
    title: "Resource Extraction",
    desc: "Every tool, website, and link mentioned in a video is automatically extracted and verified.",
    span: "col-span-1 md:col-span-2 row-span-1",
    accent: "rose",
  },
];

const accentMap = {
  emerald: { border: "rgba(52,211,153,0.12)", glow: "rgba(52,211,153,0.06)", icon: "text-emerald-400" },
  sky: { border: "rgba(56,189,248,0.12)", glow: "rgba(56,189,248,0.06)", icon: "text-sky-400" },
  violet: { border: "rgba(167,139,250,0.12)", glow: "rgba(167,139,250,0.06)", icon: "text-violet-400" },
  amber: { border: "rgba(251,191,36,0.12)", glow: "rgba(251,191,36,0.06)", icon: "text-amber-400" },
  rose: { border: "rgba(251,113,133,0.12)", glow: "rgba(251,113,133,0.06)", icon: "text-rose-400" },
};

function FeatureCard({ feature, delay }) {
  const colors = accentMap[feature.accent];
  
  return (
    <RevealBlock delay={delay} className={feature.span}>
      <motion.div
        whileHover={{ scale: 0.99, translateY: 2 }}
        transition={{ duration: 0.5, ease: easing }}
        className="h-full p-[1px] rounded-[1.5rem] cursor-default bg-white/[0.02] hover:bg-white/[0.04]"
        style={{ backgroundImage: `linear-gradient(135deg, ${colors.border}, transparent 60%)` }}
      >
        <div
          className="h-full rounded-[calc(1.5rem-1px)] p-6 flex flex-col relative overflow-hidden"
          style={{ background: `linear-gradient(180deg, rgba(15,15,15,1) 0%, rgba(10,10,10,1) 100%)` }}
        >
          {/* Accent glow */}
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-[80px] pointer-events-none transition-all duration-700" style={{ background: colors.glow }} />
          
          <div className="mb-4">
            <div className={`p-2.5 rounded-[1.25rem] bg-white/[0.03] inline-flex border border-white/[0.05] shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] ${colors.icon}`}>
              {feature.icon}
            </div>
          </div>
          
          <div className="relative z-10">
            <h3 className="font-heading text-2xl text-white mb-1.5 tracking-wide">{feature.title}</h3>
            <p className="font-body text-[14px] text-white/40 leading-relaxed">{feature.desc}</p>
          </div>
        </div>
      </motion.div>
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 auto-rows-[210px] md:auto-rows-[190px]">
          {features.map((f, i) => (
            <FeatureCard key={f.title} feature={f} delay={i * 0.1} />
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
            <RevealBlock key={step.num} delay={i * 0.15}>
              <motion.div 
                whileHover={{ scale: 0.98, translateY: 4 }}
                transition={{ duration: 0.5, ease: easing }}
                className="p-[1px] rounded-[1.5rem] bg-black/[0.06] cursor-default"
              >
                <div className="rounded-[calc(1.5rem-1px)] p-8 bg-[#F5F4F1] transition-colors duration-500" style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.8)" }}>
                  <span className="font-mono text-[11px] tracking-[0.2em] text-black/30 mb-5 block">{step.num}</span>
                  <h3 className="font-heading text-[1.6rem] text-[#111] mb-3">{step.title}</h3>
                  <p className="font-body text-[14px] text-black/50 leading-relaxed">{step.desc}</p>
                </div>
              </motion.div>
            </RevealBlock>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────── SOCIAL PROOF / QUOTE ─────────────── */
function Quote() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const scale = useTransform(scrollYProgress, [0, 0.5], [0.9, 1]);
  const y = useTransform(scrollYProgress, [0, 0.5], [100, 0]);

  return (
    <section ref={ref} className="bg-[#080808] py-40 px-4 relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-emerald-500/[0.05] blur-[100px] rounded-full" />
      </div>
      <motion.div style={{ scale, y }} className="max-w-4xl mx-auto text-center relative z-10">
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
      </motion.div>
    </section>
  );
}

/* ─────────────── CTA SECTION ─────────────── */
function CTA() {
  return (
    <section className="bg-[#F5F4F1] py-40 px-4">
      <RevealBlock className="max-w-5xl mx-auto">
        <motion.div 
          whileHover={{ scale: 0.99 }}
          transition={{ duration: 0.6, ease: easing }}
          className="p-[1.5px] rounded-[2.5rem] bg-gradient-to-br from-black/10 to-black/5"
        >
          <div
            className="rounded-[calc(2.5rem-1.5px)] px-10 py-20 md:py-28 text-center relative overflow-hidden"
            style={{ background: "linear-gradient(135deg, #111111 0%, #0a0a0a 100%)", boxShadow: "inset 0 1px 1px rgba(255,255,255,0.06)" }}
          >
            <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-emerald-500/[0.08] blur-[100px] rounded-full" />
            <div className="relative z-10 flex flex-col items-center">
              <span className="inline-block px-4 py-1.5 rounded-full border border-white/10 bg-white/[0.04] text-[10px] tracking-[0.2em] uppercase text-white/40 mb-8">Free to start</span>
              <h2 className="font-heading text-[clamp(2.5rem,7vw,5.5rem)] text-white leading-tight mb-6">
                Start building your<br />second brain today
              </h2>
              <p className="font-body text-[15px] text-white/40 max-w-md mx-auto mb-12">
                Paste your first Instagram URL and watch AI transform it into structured, searchable knowledge.
              </p>
              <Link to="/register">
                <motion.button 
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.96 }}
                  className="group inline-flex items-center gap-3 px-8 py-4 bg-white text-black text-[15px] font-semibold rounded-full hover:bg-emerald-50 transition-colors shadow-[0_0_80px_rgba(52,211,153,0.2)]"
                >
                  Create your SuperBrain
                  <span className="w-7 h-7 rounded-full bg-black/8 flex items-center justify-center group-hover:translate-x-0.5 group-hover:-translate-y-px transition-transform duration-300">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 10L10 2M10 2H3.5M10 2V8.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </span>
                </motion.button>
              </Link>
            </div>
          </div>
        </motion.div>
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
    <ReactLenis root options={{ lerp: 0.08, wheelMultiplier: 0.8, smoothWheel: true }}>
      <div className="overflow-x-hidden bg-[#080808]">
        <Nav />
        <Hero />
        <MarqueeStrip />
        <Features />
        <HowItWorks />
        <Quote />
        <CTA />
        <Footer />
      </div>
    </ReactLenis>
  );
}
