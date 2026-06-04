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
  const [lastSearchedQuery, setLastSearchedQuery] = useState("");
  const [activeTab, setActiveTab] = useState("All Saves");
  const [userProfile, setUserProfile] = useState({ username: "User", email: "" });

  // Chat state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatQuery, setChatQuery] = useState("");
  const [chatHistory, setChatHistory] = useState([
    { sender: "ai", text: "Hi! I am SuperBrain Assistant. Ask me anything about your saved product reviews, tools, how-to guides, and tutorials." }
  ]);
  const [chatLoading, setChatLoading] = useState(false);

  // Collections state
  const [collections, setCollections] = useState([]);
  const [activeCollectionId, setActiveCollectionId] = useState(null); // null means no collection filter
  const [showNewCollectionModal, setShowNewCollectionModal] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [creatingCollection, setCreatingCollection] = useState(false);

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
    fetchCollections();
  }, []);

  const fetchCollections = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;

      const response = await axios.get("http://localhost:5000/api/collections", {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCollections(response.data || []);
    } catch (err) {
      console.error("Error fetching collections:", err);
    }
  };

  const handleCreateCollection = async (e) => {
    e.preventDefault();
    if (!newCollectionName.trim() || creatingCollection) return;

    setCreatingCollection(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await axios.post(
        "http://localhost:5000/api/collections",
        { name: newCollectionName.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setCollections((prev) => [res.data, ...prev]);
      setNewCollectionName("");
      setShowNewCollectionModal(false);
    } catch (err) {
      console.error("Error creating collection:", err);
      alert(err.response?.data?.error || "Failed to create collection");
    } finally {
      setCreatingCollection(false);
    }
  };

  const handleSendQuery = async (e) => {
    e.preventDefault();
    if (!chatQuery.trim() || chatLoading) return;

    const userMsg = chatQuery.trim();
    setChatQuery("");
    setChatHistory((prev) => [...prev, { sender: "user", text: userMsg }]);
    setChatLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const response = await axios.post(
        "http://localhost:5000/api/chat",
        { query: userMsg },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setChatHistory((prev) => [
        ...prev,
        {
          sender: "ai",
          text: response.data.answer,
          references: response.data.references || []
        }
      ]);
    } catch (err) {
      console.error("Chat error:", err);
      setChatHistory((prev) => [
        ...prev,
        {
          sender: "ai",
          text: "⚠️ Sorry, I encountered an error connecting to the chat service. Please make sure the database migrations were executed."
        }
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  // Fetch reels from Node backend
  const fetchReels = async (page = 1, search = searchQuery) => {
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

      const response = await axios.get(`http://localhost:5000/api/reels?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`, {
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
    fetchReels(currentPage, searchQuery);
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

  // Client side Search + Tab filters + Collections
  const filteredReels = reels.filter((reel) => {
    // 1. Collection filter
    if (activeCollectionId) {
      const activeCol = collections.find((c) => c.id === activeCollectionId);
      const collectionReelIds = activeCol
        ? new Set(activeCol.reel_collections.map((rc) => rc.reel_id))
        : new Set();
      if (!collectionReelIds.has(reel.id)) {
        return false;
      }
    }

    // 2. Search & content type filters
    const title = (reel.title || reel.reel_metadata?.title || "").toLowerCase();
    const summary = (reel.summary || reel.reel_metadata?.summary || "").toLowerCase();
    const author = (reel.author_username || "").toLowerCase();
    const tags = (reel.tags || reel.reel_metadata?.tags || []).join(" ").toLowerCase();
    const query = searchQuery.toLowerCase();

    // If server-side search was executed, bypass client-side keyword matching
    const matchesSearch = (lastSearchedQuery && lastSearchedQuery.toLowerCase() === query)
      ? true
      : (title.includes(query) || summary.includes(query) || author.includes(query) || tags.includes(query));

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
            placeholder="Search transcripts, topics, tools (Enter)..."
            className="bg-transparent border-none text-xs text-neutral-800 dark:text-neutral-200 outline-none w-full placeholder-neutral-400 dark:placeholder-neutral-600"
            value={searchQuery}
            onChange={(e) => {
              const val = e.target.value;
              setSearchQuery(val);
              if (val.trim() === "") {
                setLastSearchedQuery("");
                setReels([]);
                fetchReels(1, "");
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setReels([]);
                setLastSearchedQuery(searchQuery);
                fetchReels(1, searchQuery);
              }
            }}
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
            placeholder="Search saved items (Enter)..."
            className="bg-transparent border-none text-xs text-neutral-800 dark:text-neutral-200 outline-none w-full"
            value={searchQuery}
            onChange={(e) => {
              const val = e.target.value;
              setSearchQuery(val);
              if (val.trim() === "") {
                setLastSearchedQuery("");
                setReels([]);
                fetchReels(1, "");
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setReels([]);
                setLastSearchedQuery(searchQuery);
                fetchReels(1, searchQuery);
              }
            }}
          />
        </div>

        {/* Collections Bar */}
        <div className="mb-6 bg-white dark:bg-[#0d0d0d] border border-neutral-200 dark:border-[#181818] p-5 rounded-[3px] transition-colors duration-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-mono uppercase tracking-wider text-neutral-450 dark:text-neutral-400">📂 Collections</h3>
            <button 
              onClick={() => setShowNewCollectionModal(true)}
              className="text-xs font-mono text-emerald-600 hover:text-emerald-500 dark:text-emerald-450 dark:hover:text-emerald-400 flex items-center gap-1 hover:underline"
            >
              <span>+ Create Collection</span>
            </button>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setActiveCollectionId(null)}
              className={`px-3 py-2 text-xs font-mono border rounded-[3px] transition-all flex items-center gap-1.5 whitespace-nowrap ${
                activeCollectionId === null
                  ? "bg-neutral-900 dark:bg-emerald-500 text-white dark:text-black border-transparent"
                  : "bg-neutral-50 dark:bg-[#141414] border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-neutral-400 dark:hover:border-neutral-600"
              }`}
            >
              📂 All Saves
            </button>
            {collections.map((col) => {
              const isSelected = activeCollectionId === col.id;
              const count = col.reel_collections?.length || 0;
              return (
                <button
                  key={col.id}
                  onClick={() => setActiveCollectionId(col.id)}
                  className={`px-3 py-2 text-xs font-mono border rounded-[3px] transition-all flex items-center gap-1.5 whitespace-nowrap ${
                    isSelected
                      ? "bg-neutral-900 dark:bg-emerald-500 text-white dark:text-black border-transparent"
                      : "bg-neutral-50 dark:bg-[#141414] border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-neutral-400 dark:hover:border-neutral-600"
                  }`}
                >
                  <span>📁 {col.name}</span>
                  <span className={`text-[10px] px-1 rounded-sm ${isSelected ? "bg-white/20 text-white" : "bg-neutral-200 dark:bg-neutral-800 text-neutral-500"}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
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
          <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-6 [column-fill:balance]">
            {Array.from({ length: 8 }).map((_, idx) => (
              <div
                key={idx}
                className="break-inside-avoid mb-6 block flex flex-col bg-white dark:bg-[#0d0d0d] border border-neutral-200 dark:border-[#181818] rounded-[20px] overflow-hidden animate-pulse shadow-sm h-64"
              >
                {/* Image Skeleton */}
                <div className="flex-1 bg-neutral-100 dark:bg-[#141414] relative overflow-hidden" />
                {/* Content Body Skeleton */}
                <div className="p-4 space-y-3">
                  <div className="h-3.5 bg-neutral-200 dark:bg-neutral-800/60 rounded-[4px] w-5/6" />
                  <div className="h-3 bg-neutral-100 dark:bg-neutral-800/40 rounded-[4px] w-2/3" />
                </div>
                {/* Bottom Bar Skeleton */}
                <div className="px-4 pb-4 pt-3 border-t border-neutral-100 dark:border-[#141414] flex justify-between items-center mt-auto">
                  <div className="h-3 bg-neutral-100 dark:bg-neutral-800 rounded-[2px] w-24" />
                  <div className="h-6 bg-neutral-100 dark:bg-neutral-800 rounded-[3px] w-12" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="bg-rose-500/5 border border-rose-500/10 p-6 rounded-[3px] text-center my-10">
            <p className="text-sm text-rose-600 dark:text-rose-400 font-mono">{error}</p>
            <button 
              onClick={() => fetchReels(currentPage)}
              className="mt-4 text-xs font-mono text-neutral-500 dark:text-neutral-400 hover:underline"
            >
              Retry Connection
            </button>
          </div>
        ) : filteredReels.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-[#0d0d0d] border border-neutral-200 dark:border-[#181818] rounded-[3px]">
            <p className="text-xs font-mono text-neutral-500 dark:text-neutral-400">No items found matching the selected criteria.</p>
          </div>
        ) : (
          <>
            {/* Reel Masonry Grid */}
            <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-6 [column-fill:balance]">
              {filteredReels.map((reel) => (
                <div key={reel.id} className="break-inside-avoid mb-6 block">
                  <ReelCard 
                    reel={reel} 
                    collections={collections}
                    onRefreshCollections={fetchCollections}
                  />
                </div>
              ))}
            </div>

            {/* Infinite Scroll Loader at bottom */}
            {loading && currentPage > 1 && (
              <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-6 [column-fill:balance] mt-6">
                {Array.from({ length: 4 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="break-inside-avoid mb-6 block flex flex-col bg-white dark:bg-[#0d0d0d] border border-neutral-200 dark:border-[#181818] rounded-[20px] overflow-hidden animate-pulse shadow-sm h-64"
                  >
                    <div className="flex-1 bg-neutral-100 dark:bg-[#141414] relative overflow-hidden" />
                    <div className="p-4 space-y-3">
                      <div className="h-3.5 bg-neutral-200 dark:bg-neutral-800/60 rounded-[4px] w-5/6" />
                      <div className="h-3 bg-neutral-100 dark:bg-neutral-800/40 rounded-[4px] w-2/3" />
                    </div>
                    <div className="px-4 pb-4 pt-3 border-t border-neutral-100 dark:border-[#141414] flex justify-between items-center mt-auto">
                      <div className="h-3 bg-neutral-100 dark:bg-neutral-800 rounded-[2px] w-24" />
                      <div className="h-6 bg-neutral-100 dark:bg-neutral-800 rounded-[3px] w-12" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Modal: New Collection */}
        {showNewCollectionModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-[#0d0d0d] border border-neutral-200 dark:border-[#1e1e1e] rounded-[3px] p-6 max-w-md w-full">
              <h3 className="text-sm font-mono uppercase tracking-wider text-neutral-800 dark:text-neutral-200 mb-4">Create New Collection</h3>
              <form onSubmit={handleCreateCollection} className="space-y-4">
                <input
                  type="text"
                  placeholder="Collection Name (e.g., Tools, Learn React)..."
                  className="w-full bg-neutral-50 dark:bg-[#141414] border border-neutral-205 dark:border-[#222] focus:border-neutral-400 dark:focus:border-neutral-700 transition-colors px-3 py-2 text-xs text-neutral-900 dark:text-emerald-500 outline-none rounded-[3px]"
                  value={newCollectionName}
                  onChange={(e) => setNewCollectionName(e.target.value)}
                  autoFocus
                />
                <div className="flex justify-end gap-2 text-xs font-mono">
                  <button
                    type="button"
                    onClick={() => setShowNewCollectionModal(false)}
                    className="border border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600 px-4 py-2 rounded-[3px]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creatingCollection || !newCollectionName.trim()}
                    className="bg-neutral-900 dark:bg-emerald-500 hover:bg-neutral-800 dark:hover:bg-emerald-400 text-white dark:text-black px-4 py-2 rounded-[3px]"
                  >
                    {creatingCollection ? "Creating..." : "Create"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Floating Action Button: AI Assistant */}
        <button
          onClick={() => setChatOpen(true)}
          className="fixed bottom-6 right-6 z-40 bg-neutral-900 hover:bg-neutral-850 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-black p-3.5 shadow-lg flex items-center justify-center rounded-full hover:scale-105 transition-all duration-200"
          title="Ask SuperBrain AI"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        </button>

        {/* Slide-out Panel: AI Chat Assistant */}
        {chatOpen && (
          <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-[2px]">
            {/* Click outside to close */}
            <div className="flex-1" onClick={() => setChatOpen(false)} />
            
            <div className="w-full max-w-lg bg-white dark:bg-[#0a0a0a] border-l border-neutral-200 dark:border-[#1c1c1c] h-full flex flex-col shadow-2xl animate-slide-in">
              {/* Chat Header */}
              <div className="px-6 py-4 border-b border-neutral-200 dark:border-[#1c1c1c] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
                  <h2 className="text-xs font-mono font-bold tracking-wider uppercase text-neutral-850 dark:text-neutral-100">SuperBrain RAG Assistant</h2>
                </div>
                <button
                  onClick={() => setChatOpen(false)}
                  className="text-neutral-450 hover:text-neutral-700 dark:text-neutral-500 dark:hover:text-neutral-350 text-xs font-mono"
                >
                  Close [×]
                </button>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 p-6 overflow-y-auto space-y-4 font-sans text-sm">
                {chatHistory.map((msg, index) => (
                  <div key={index} className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}>
                    <div className={`max-w-[85%] rounded-[12px] px-4 py-3 ${
                      msg.sender === "user"
                        ? "bg-neutral-900 text-white dark:bg-emerald-500/10 dark:text-emerald-450 border border-transparent dark:border-emerald-500/20"
                        : "bg-neutral-100 dark:bg-[#111] text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-850"
                    }`}>
                      <p className="leading-relaxed whitespace-pre-wrap text-xs font-mono">{msg.text}</p>
                      
                      {/* References Card */}
                      {msg.references && msg.references.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-800 space-y-1.5">
                          <p className="text-[10px] font-mono text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">Citations:</p>
                          <div className="grid grid-cols-1 gap-1.5">
                            {msg.references.map((ref) => (
                              <a
                                key={ref.id}
                                href={`/imports/${ref.id}`}
                                className="inline-flex items-center justify-between text-[10px] font-mono text-emerald-600 dark:text-emerald-400 hover:underline bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-1.5 rounded-[2px]"
                              >
                                <span className="truncate max-w-[200px]">💡 {ref.title}</span>
                                <span className="text-[9px] text-neutral-450 dark:text-neutral-500">@{ref.author_username}</span>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex items-center gap-2 text-neutral-500 dark:text-neutral-450 text-xs font-mono bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-850 px-4 py-3 rounded-[12px] w-max">
                    <div className="w-1.5 h-1.5 bg-neutral-500 dark:bg-emerald-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <div className="w-1.5 h-1.5 bg-neutral-500 dark:bg-emerald-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <div className="w-1.5 h-1.5 bg-neutral-500 dark:bg-emerald-400 rounded-full animate-bounce" />
                    <span>Analyzing matching bookmarks...</span>
                  </div>
                )}
              </div>

              {/* Chat Input */}
              <form onSubmit={handleSendQuery} className="p-4 border-t border-neutral-200 dark:border-[#1c1c1c] bg-white dark:bg-[#070707] flex gap-2">
                <input
                  type="text"
                  placeholder="Ask a question (e.g., What websites did I save for learning CSS?)..."
                  className="flex-1 bg-neutral-50 dark:bg-[#111] border border-neutral-200 dark:border-neutral-850 focus:border-neutral-450 dark:focus:border-neutral-700 transition-colors px-3 py-2.5 text-xs outline-none rounded-[3px] placeholder-neutral-450 dark:placeholder-neutral-600"
                  value={chatQuery}
                  onChange={(e) => setChatQuery(e.target.value)}
                  disabled={chatLoading}
                />
                <button
                  type="submit"
                  disabled={chatLoading || !chatQuery.trim()}
                  className="bg-neutral-900 dark:bg-emerald-500 hover:bg-neutral-850 dark:hover:bg-emerald-400 text-white dark:text-black font-mono font-bold text-xs uppercase px-4 py-2.5 rounded-[3px] transition-colors disabled:opacity-50"
                >
                  Ask
                </button>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
