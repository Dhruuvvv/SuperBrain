import React, { useState, useEffect } from "react";
import axios from "axios";
import { supabase } from "../utils/supabaseClient";
import ReelCard from "../components/ReelCard";
import ThemeToggle from "../components/ThemeToggle";

export default function Dashboard() {
  const [reels, setReels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Submit new Reel state
  const [newUrl, setNewUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState(null);
  const [submitError, setSubmitError] = useState(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("All Saves");
  const [userProfile, setUserProfile] = useState({ username: "User", email: "" });

  // Pagination / Infinite Scroll
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 12;

  const tabs = ["All Saves", "Tech", "Software", "Tutorial", "Finance", "Lifestyle", "Other"];

  // Fetch active user details
  useEffect(() => {
    async function getUserDetails() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
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
        
        setUserProfile({
          username: profile?.username || profile?.full_name || session.user.email.split("@")[0],
          email: session.user.email
        });
      }
    }
    getUserDetails();
  }, []);

  // Fetch reels from Node backend
  const fetchReels = async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      if (!token) {
        setError("User session not found. Please log in.");
        setLoading(false);
        return;
      }

      const response = await axios.get(`http://localhost:5000/api/reels?page=${page}&limit=${limit}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const newReels = response.data.data || [];
      setReels((prev) => {
        if (page === 1) {
          return newReels;
        } else {
          const existingIds = new Set(prev.map((r) => r.id));
          return [...prev, ...newReels.filter((r) => !existingIds.has(r.id))];
        }
      });
      setTotalPages(response.data.meta?.totalPages || 1);
      setCurrentPage(page);
    } catch (err) {
      console.error("Error fetching reels:", err);
      setError(err.response?.data?.error || "Failed to load saved items.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReels(currentPage);
  }, [currentPage]);

  // Handle Infinite Scroll
  useEffect(() => {
    const handleScroll = () => {
      if (loading || currentPage >= totalPages) return;

      if (
        window.innerHeight + document.documentElement.scrollTop >=
        document.documentElement.offsetHeight - 150
      ) {
        setCurrentPage((prev) => prev + 1);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [loading, currentPage, totalPages]);

  // Submit new Reel URL to start analysis pipeline
  const handleAddReel = async (e) => {
    e.preventDefault();
    if (!newUrl.trim()) return;

    setSubmitting(true);
    setSubmitMessage("Initializing download and AI transcription pipeline...");
    setSubmitError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        setSubmitError("Unauthorized: Log in to save items.");
        setSubmitting(false);
        return;
      }

      await axios.post(
        "http://localhost:5000/api/reels",
        { url: newUrl },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setSubmitMessage("Successfully saved! AI processing is running in the background.");
      setNewUrl("");
      if (currentPage === 1) {
        fetchReels(1);
      } else {
        setCurrentPage(1);
      }
    } catch (err) {
      console.error("Error saving reel:", err);
      setSubmitError(err.response?.data?.error || "Failed to start AI analysis.");
      setSubmitMessage(null);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  // Client side Search + Tab filters
  const filteredReels = reels.filter((reel) => {
    const title = (reel.title || reel.reel_metadata?.title || "").toLowerCase();
    const summary = (reel.summary || reel.reel_metadata?.summary || "").toLowerCase();
    const author = (reel.author_username || "").toLowerCase();
    const tags = (reel.tags || reel.reel_metadata?.tags || []).join(" ").toLowerCase();
    const query = searchQuery.toLowerCase();

    const matchesSearch = title.includes(query) || summary.includes(query) || author.includes(query) || tags.includes(query);

    if (activeTab === "All Saves") {
      return matchesSearch;
    } else {
      const contentType = (reel.content_type || reel.reel_metadata?.content_type || "").toLowerCase();
      return matchesSearch && contentType === activeTab.toLowerCase();
    }
  });

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-[#0a0a0a] text-neutral-900 dark:text-neutral-100 font-sans selection:bg-emerald-500 dark:selection:bg-emerald-400 selection:text-white dark:selection:text-black transition-colors duration-200">
      
      {/* Top Navbar */}
      <nav className="sticky top-0 z-50 bg-white/95 dark:bg-[#0a0a0a]/90 backdrop-blur-md border-b border-neutral-200 dark:border-[#181818] px-6 py-4 flex items-center justify-between transition-colors duration-200">
        <div className="flex items-center gap-2">
          <span className="text-neutral-900 dark:text-emerald-400 font-mono font-bold tracking-tight text-lg">💡 SUPERBRAIN</span>
          <span className="text-[10px] font-mono bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-500 dark:text-neutral-400 px-1.5 py-0.5 rounded-[2px]">BETA</span>
        </div>

        {/* Global Search inside Navbar */}
        <div className="hidden md:flex items-center bg-neutral-50 dark:bg-[#111] border border-neutral-200 dark:border-[#222] focus-within:border-neutral-400 dark:focus-within:border-neutral-700 transition-colors rounded-[3px] px-3 py-1.5 w-96">
          <svg className="w-4 h-4 text-neutral-400 dark:text-neutral-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search transcripts, topics, tools..."
            className="bg-transparent border-none text-xs text-neutral-800 dark:text-neutral-200 outline-none w-full placeholder-neutral-400 dark:placeholder-neutral-600"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex items-center justify-center font-mono text-neutral-800 dark:text-emerald-400 font-bold rounded-[3px] text-xs">
              {userProfile.username[0]?.toUpperCase() || "U"}
            </div>
            <span className="text-xs font-mono text-neutral-600 dark:text-neutral-300">@{userProfile.username}</span>
          </div>
          <ThemeToggle />
          <button 
            onClick={handleLogout}
            className="text-xs font-mono border border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600 px-3 py-1.5 rounded-[3px] transition-colors bg-white dark:bg-transparent text-neutral-700 dark:text-neutral-300"
          >
            Logout
          </button>
        </div>
      </nav>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        
        {/* Top Section: Quick Import Panel */}
        <div className="mb-10 bg-white dark:bg-[#0d0d0d] border border-neutral-200 dark:border-[#181818] p-6 rounded-[3px] transition-colors duration-200">
          <h2 className="text-sm font-mono tracking-wider text-neutral-500 dark:text-neutral-400 mb-3 uppercase">⚡ Create New AI Import</h2>
          <form onSubmit={handleAddReel} className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="Paste Instagram Reel, Video, or Carousel Post URL..."
              className="flex-1 bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#222] focus:border-neutral-400 dark:focus:border-neutral-700 transition-colors px-4 py-2.5 text-xs text-neutral-900 dark:text-emerald-500 outline-none rounded-[3px] placeholder-neutral-400 dark:placeholder-neutral-600"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              disabled={submitting}
            />
            <button
              type="submit"
              disabled={submitting}
              className="bg-neutral-900 dark:bg-emerald-500 hover:bg-neutral-800 dark:hover:bg-emerald-400 text-white dark:text-black font-mono font-bold text-xs uppercase px-6 py-2.5 rounded-[3px] transition-colors disabled:opacity-50"
            >
              {submitting ? "Analyzing..." : "Import & Process"}
            </button>
          </form>

          {/* Inline pipeline messages */}
          {submitMessage && (
            <p className="mt-3 text-xs font-mono text-neutral-600 dark:text-emerald-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-neutral-600 dark:bg-emerald-400 rounded-full animate-pulse" />
              {submitMessage}
            </p>
          )}
          {submitError && (
            <p className="mt-3 text-xs font-mono text-rose-500 dark:text-rose-400">
              ⚠️ {submitError}
            </p>
          )}
        </div>

        {/* Mobile Search Bar */}
        <div className="flex md:hidden items-center bg-white dark:bg-[#111] border border-neutral-200 dark:border-[#222] focus-within:border-neutral-400 dark:focus-within:border-neutral-700 transition-colors rounded-[3px] px-3 py-2 mb-6">
          <svg className="w-4 h-4 text-neutral-400 dark:text-neutral-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search saved items..."
            className="bg-transparent border-none text-xs text-neutral-800 dark:text-neutral-200 outline-none w-full"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Tab Filters */}
        <div className="flex items-center gap-1 overflow-x-auto border-b border-neutral-200 dark:border-[#181818] pb-px mb-8 scrollbar-none transition-colors duration-200">
          {tabs.map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`whitespace-nowrap px-4 py-2 text-xs font-mono border-b-2 transition-all duration-200 ${
                  isActive
                    ? "border-neutral-900 dark:border-emerald-400 text-neutral-900 dark:text-emerald-400 font-bold"
                    : "border-transparent text-neutral-450 dark:text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300"
                }`}
              >
                {tab}
              </button>
            );
          })}
        </div>

        {/* Loader, Error, Grid */}
        {loading && currentPage === 1 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-6 h-6 border-2 border-neutral-800 dark:border-emerald-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-mono text-neutral-550 dark:text-neutral-500">Querying intelligence database...</p>
          </div>
        ) : error ? (
          <div className="bg-rose-500/5 border border-rose-500/10 p-6 rounded-[3px] text-center my-10">
            <p className="text-sm text-rose-600 dark:text-rose-400 font-mono">{error}</p>
            <button 
              onClick={() => fetchReels(currentPage)}
              className="mt-4 text-xs font-mono text-neutral-555 dark:text-neutral-405 hover:underline"
            >
              Retry Connection
            </button>
          </div>
        ) : filteredReels.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-[#0d0d0d] border border-neutral-200 dark:border-[#181818] rounded-[3px]">
            <p className="text-xs font-mono text-neutral-555 dark:text-neutral-500">No items found matching the selected criteria.</p>
          </div>
        ) : (
          <>
            {/* Reel Masonry Layout */}
            <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-6 [column-fill:balance]">
              {filteredReels.map((reel) => (
                <div key={reel.id} className="break-inside-avoid mb-6 block">
                  <ReelCard reel={reel} />
                </div>
              ))}
            </div>

            {/* Infinite Scroll Loader at bottom */}
            {loading && currentPage > 1 && (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <div className="w-5 h-5 border-2 border-neutral-800 dark:border-emerald-400 border-t-transparent rounded-full animate-spin" />
                <p className="text-[10px] font-mono text-neutral-500">Loading more...</p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
