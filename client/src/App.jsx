import { Routes, Route, Link, Navigate } from "react-router-dom";
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
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        if (session.user.email === "admin@gmail.com") {
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
      setLoading(false);
    }
    checkUser();
  }, []);

  function logout() {
    supabase.auth.signOut();
    setRole("guest");
    setUsername("");
    window.location.href = "/login";
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-[#0a0a0a] text-neutral-900 dark:text-neutral-100 flex flex-col items-center justify-center gap-3 font-mono text-xs transition-colors duration-200">
        <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
        <p>Booting SuperBrain Core...</p>
      </div>
    );
  }

  // Check if we are in admin mode or public login view to render legacy container style
  const isLegacyView = role === "admin" || role === "guest";

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-[#0a0a0a] text-neutral-900 dark:text-neutral-100 selection:bg-emerald-500 dark:selection:bg-emerald-400 selection:text-white dark:selection:text-black transition-colors duration-200">
      
      {/* RENDER HEADER ONLY FOR ADMIN OR GUEST VIEWS */}
      {isLegacyView && (
        <div className="bg-white dark:bg-[#0f0f0f] border-b border-neutral-200 dark:border-neutral-900 px-8 py-4 flex flex-col md:flex-row items-center justify-between gap-4 transition-colors duration-200">
          <h1 className="text-lg font-bold text-neutral-900 dark:text-neutral-200 font-mono flex items-center gap-2">
            💡 SuperBrain
            {username && (
              <span className="text-xs font-normal text-emerald-600 dark:text-emerald-450">
                👋 @{username}
              </span>
            )}
          </h1>

          {/* NAVBAR */}
          <div className="flex items-center gap-3">
            {role === "guest" && (
              <>
                <Link to="/login">
                  <button className="px-4 py-1.5 text-xs font-mono border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-neutral-400 dark:hover:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 rounded-[3px] transition-colors">
                    Login
                  </button>
                </Link>
                <Link to="/register">
                  <button className="px-4 py-1.5 text-xs font-mono border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-neutral-400 dark:hover:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 rounded-[3px] transition-colors">
                    Register
                  </button>
                </Link>
              </>
            )}

            {role === "admin" && (
              <>
                <Link to="/admin/users">
                  <button className="px-3 py-1.5 text-xs font-mono border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-neutral-400 dark:hover:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 rounded-[3px] transition-colors">
                    👥 Users
                  </button>
                </Link>
                <Link to="/admin/reels">
                  <button className="px-3 py-1.5 text-xs font-mono border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-neutral-400 dark:hover:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 rounded-[3px] transition-colors">
                    🎥 Reels
                  </button>
                </Link>
                <Link to="/admin/transcripts">
                  <button className="px-3 py-1.5 text-xs font-mono border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-neutral-400 dark:hover:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 rounded-[3px] transition-colors">
                    📝 Transcripts
                  </button>
                </Link>
                <ThemeToggle />
                <button 
                  onClick={logout} 
                  className="px-3 py-1.5 text-xs font-mono border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 hover:border-rose-450 dark:hover:border-rose-700 bg-rose-50 dark:bg-rose-950/20 rounded-[3px] transition-colors"
                >
                  Logout
                </button>
              </>
            )}
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
            role === "user" ? <Dashboard /> : <Navigate to="/login" replace />
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
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </div>
  );
}

export default App;
