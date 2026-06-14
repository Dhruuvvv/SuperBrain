import { Routes, Route, Link, Navigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "./utils/supabaseClient";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import ReelDetail from "./pages/ReelDetail";
import Users from "./pages/Users";
import Reels from "./pages/Reels";
import Transcripts from "./pages/Transcripts";
import ThemeToggle from "./components/ThemeToggle";
import { Toaster } from "./components/ui/sonner";
import { Brain } from "lucide-react";

const STEPS = [
  "Initializing neural core",
  "Synchronizing database nodes",
  "Restoring system parameters",
  "Finalizing boot sequence"
];

function LoadingScreen() {
  const [progress, setProgress] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    const intervalTime = 30;
    const increment = 100 / (1500 / intervalTime); // Complete in 1.5s
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          return 100;
        }
        return prev + increment;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const stepInterval = 1500 / STEPS.length;
    const timer = setInterval(() => {
      setStepIndex((prev) => {
        if (prev < STEPS.length - 1) {
          return prev + 1;
        }
        return prev;
      });
    }, stepInterval);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-[#FAFAF8] dark:bg-[#050505] text-[#111111] dark:text-[#F2F2F0] flex flex-col items-center justify-center font-sans p-6 relative overflow-hidden transition-colors duration-500">
      {/* Custom Styles for Neural Blink */}
      <style>{`
        @keyframes neural-blink {
          0%, 100% {
            opacity: 0.3;
            transform: scale(0.95);
            filter: drop-shadow(0 0 4px rgba(16, 185, 129, 0.15));
          }
          50% {
            opacity: 1;
            transform: scale(1.05);
            filter: drop-shadow(0 0 16px rgba(16, 185, 129, 0.5));
          }
        }
        .animate-neural-blink {
          animation: neural-blink 2s cubic-bezier(0.25, 1, 0.5, 1) infinite;
        }
      `}</style>

      {/* Noise Texture Overlay */}
      <div className="pointer-events-none fixed inset-0 z-50 bg-[radial-gradient(#000_1px,transparent_1px)] dark:bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px] opacity-[0.02] dark:opacity-[0.03]" />

      {/* Atmospheric Glow */}
      <div className="pointer-events-none absolute w-[450px] h-[450px] bg-emerald-500/10 dark:bg-emerald-400/[0.02] rounded-full blur-[130px] z-0 animate-pulse" />

      {/* Centered Minimal Container */}
      <div className="w-full max-w-sm flex flex-col items-center gap-12 z-10 text-center">
        
        {/* Fine Rotating Ring & Premium Brain Icon */}
        <div className="relative w-24 h-24 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border border-black/[0.04] dark:border-white/[0.04]" />
          <div className="absolute inset-2 rounded-full border border-t-emerald-500/35 dark:border-t-emerald-400/35 border-r-transparent border-b-transparent border-l-transparent animate-spin [animation-duration:3s]" />
          <div className="absolute w-14 h-14 rounded-full bg-emerald-500/5 dark:bg-emerald-400/[0.01] blur-md" />
          
          <div className="relative z-10 animate-neural-blink flex items-center justify-center">
            <Brain 
              className="w-10 h-10 text-emerald-500 dark:text-emerald-400" 
              strokeWidth={1.1} 
            />
          </div>
        </div>

        {/* Brand Curation */}
        <div className="space-y-1.5">
          <h1 className="font-heading text-4xl text-black dark:text-white font-normal italic leading-none tracking-wide">
            SuperBrain
          </h1>
          <p className="text-[9px] font-mono tracking-[0.3em] uppercase text-black/30 dark:text-white/30">
            Aesthetic Curation System
          </p>
        </div>

        {/* Micro-Progress Bar */}
        <div className="w-full space-y-4">
          <div className="w-full h-[1px] bg-black/10 dark:bg-white/10 rounded-full overflow-hidden relative">
            <div 
              className="h-full bg-emerald-500/80 dark:bg-emerald-400/85 transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          
          {/* Staggered Status & Percentage */}
          <div className="flex justify-between items-center px-1 font-mono text-[9px] uppercase tracking-[0.2em] text-black/40 dark:text-white/40">
            <span className="animate-pulse">{STEPS[stepIndex]}</span>
            <span>{Math.round(progress)}%</span>
          </div>
        </div>

      </div>

      {/* Decorative Cybernetic Frame Corner Elements */}
      <div className="absolute top-8 left-8 w-6 h-6 border-t border-l border-black/[0.06] dark:border-white/[0.06] pointer-events-none" />
      <div className="absolute top-8 right-8 w-6 h-6 border-t border-r border-black/[0.06] dark:border-white/[0.06] pointer-events-none" />
      <div className="absolute bottom-8 left-8 w-6 h-6 border-b border-l border-black/[0.06] dark:border-white/[0.06] pointer-events-none" />
      <div className="absolute bottom-8 right-8 w-6 h-6 border-b border-r border-black/[0.06] dark:border-white/[0.06] pointer-events-none" />
    </div>
  );
}

function App() {
  const [role, setRole] = useState("guest");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(true);

  // Initialize theme and restore session on load
  useEffect(() => {
    // 1. Initial Theme setup
    const savedTheme = localStorage.getItem("theme") || "dark";
    const root = window.document.documentElement;
    if (savedTheme === "dark") {
      root.classList.add("dark");
      root.style.backgroundColor = "#0a0a0a";
    } else {
      root.classList.remove("dark");
      root.style.backgroundColor = "#ffffff";
    }

    // 2. Auth Session Check
    async function checkUser() {
      const startTime = Date.now();
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        if (session.user.email === "admin@gmail.com" || session.user.email === "admin@superbrain.com" || session.user.email === "owner@superbrain.com") {
          setRole("admin");
          setUsername("Admin");
        } else {
          setRole("user");
          // Fetch profile details
          let { data: profile } = await supabase
            .from("profiles")
            .select("username, full_name")
            .eq("id", session.user.id)
            .maybeSingle();

          if (!profile) {
            // Self-healing: profile row is missing, insert it on the fly
            const fallbackUsername = session.user.email.split("@")[0];
            const { data: newProfile, error: insertError } = await supabase
              .from("profiles")
              .upsert({
                id: session.user.id,
                full_name: session.user.user_metadata?.full_name || fallbackUsername,
                username: session.user.user_metadata?.username || fallbackUsername,
                email: session.user.email
              })
              .select("username, full_name")
              .maybeSingle();
            
            if (!insertError && newProfile) {
              profile = newProfile;
            }
          }

          setUsername(profile?.username || profile?.full_name || session.user.email.split("@")[0]);
        }
      }
      const elapsedTime = Date.now() - startTime;
      const minDelay = 1800; // 1.8 seconds minimum loading animation
      if (elapsedTime < minDelay) {
        setTimeout(() => {
          setLoading(false);
        }, minDelay - elapsedTime);
      } else {
        setLoading(false);
      }
    }
    checkUser();
  }, []);

  function logout() {
    supabase.auth.signOut();
    setRole("guest");
    setUsername("");
    window.location.href = "/login";
  }

  const location = useLocation();
  const isAuthPage = location.pathname === '/login' || location.pathname === '/register';

  if (loading) {
    return <LoadingScreen />;
  }

  // Check if we are in admin mode or public login view to render legacy container style
  const isLegacyView = (role === "admin" || role === "guest") && !isAuthPage;

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-[#0a0a0a] text-neutral-900 dark:text-neutral-100 selection:bg-emerald-500 dark:selection:bg-emerald-400 selection:text-white dark:selection:text-black transition-colors duration-200">
      
      {/* PREMIUM FLOATING ADMIN/GUEST HEADER */}
      {isLegacyView && (
        <div className="fixed top-0 left-0 right-0 z-50 px-4 pt-6 pb-2 pointer-events-none">
          <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 bg-white/70 dark:bg-[#111111]/80 backdrop-blur-xl border border-black/5 dark:border-white/10 p-2 pl-6 rounded-full shadow-2xl pointer-events-auto transition-colors duration-300">
            <h1 className="text-xl font-bold text-neutral-900 dark:text-white flex items-center gap-2.5">
              <span className="flex items-center justify-center bg-black dark:bg-white text-white dark:text-black rounded-md p-1.5 shadow-sm">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z"></path>
                </svg>
              </span>
              SuperBrain
              {username && (
                <span className="text-[10px] font-sans not-italic font-bold tracking-wider uppercase text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full ml-3 shadow-sm">
                  Admin: @{username}
                </span>
              )}
            </h1>

            {/* NAVBAR */}
            <div className="flex items-center gap-1">
              {role === "guest" && (
                <>
                  <Link to="/login">
                    <button className="px-5 py-2 text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-all">
                      Login
                    </button>
                  </Link>
                  <Link to="/register">
                    <button className="px-5 py-2 text-sm font-medium bg-black dark:bg-white text-white dark:text-black rounded-full hover:scale-105 transition-all shadow-lg">
                      Register
                    </button>
                  </Link>
                </>
              )}

              {role === "admin" && (
                <>
                  <Link to="/admin/users">
                    <button className="px-4 py-2 text-sm font-medium text-neutral-600 dark:text-neutral-300 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-all">
                      Users
                    </button>
                  </Link>
                  <Link to="/admin/reels">
                    <button className="px-4 py-2 text-sm font-medium text-neutral-600 dark:text-neutral-300 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-all">
                      Reels
                    </button>
                  </Link>
                  <Link to="/admin/transcripts">
                    <button className="px-4 py-2 text-sm font-medium text-neutral-600 dark:text-neutral-300 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-all">
                      Transcripts
                    </button>
                  </Link>
                  
                  <div className="w-[1px] h-4 bg-black/10 dark:bg-white/10 mx-2" />
                  
                  <div className="scale-90 origin-center">
                    <ThemeToggle />
                  </div>
                  
                  <button 
                    onClick={logout} 
                    className="ml-2 px-4 py-2 text-sm font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 rounded-full transition-all"
                  >
                    Logout
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CORE ROUTES */}
      <Routes>
        <Route path="/login" element={<Login setRole={setRole} setUsername={setUsername} />} />
        <Route path="/register" element={<Register />} />
        
        {/* Protected Dashboard & Reel Details */}
        <Route 
          path="/dashboard" 
          element={
            role === "user" ? <Dashboard /> : role === "admin" ? <Navigate to="/admin/users" replace /> : <Navigate to="/login" replace />
          } 
        />
        <Route 
          path="/imports/:id" 
          element={
            role === "user" ? <ReelDetail /> : <Navigate to="/login" replace />
          } 
        />

        {/* Admin Dashboard */}
        <Route path="/admin/users" element={<Users />} />
        <Route path="/admin/reels" element={<Reels />} />
        <Route path="/admin/transcripts" element={<Transcripts />} />

        {/* Fallback */}
      </Routes>
      <Toaster />
    </div>
  );
}

export default App;
