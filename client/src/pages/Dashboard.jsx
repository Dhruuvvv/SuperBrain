import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import axios from "axios";
import { supabase } from "../utils/supabaseClient";
import ReelCard from "../components/ReelCard";
import ThemeToggle from "../components/ThemeToggle";
import { FaviconSearch } from "../components/unlumen-ui/favicon-search";
import { ListViewIcon } from "../components/unlumen-ui/list-view-icon";
import { motion, AnimatePresence } from "motion/react";

import { Input } from "components/ui/input";
import { Button } from "components/ui/button";
import { Avatar, AvatarFallback } from "components/ui/avatar";
import { ScrollArea, ScrollBar } from "components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "components/ui/sheet";
import { toast } from "sonner";

import Lenis from "lenis";

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.05,
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 380,
      damping: 30,
    }
  }
};

export default function Dashboard() {
  const [reels, setReels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Submit new Reel state
  const [newUrl, setNewUrl] = useState("");
  const [urlError, setUrlError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const [isImportOpen, setIsImportOpen] = useState(false);

  // Prevent refresh/close while submitting
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (submitting) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [submitting]);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [lastSearchedQuery, setLastSearchedQuery] = useState("");
  const [activeTab, setActiveTab] = useState("All Saves");
  const [userProfile, setUserProfile] = useState({ username: "User", email: "" });

  // Sidebar state
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(false);

  // Chat state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatQuery, setChatQuery] = useState("");
  const [chatHistory, setChatHistory] = useState([
    { sender: "ai", text: "Hi! I am SuperBrain Assistant. Ask me anything about your saved product reviews, tools, how-to guides, and tutorials." }
  ]);
  const [chatLoading, setChatLoading] = useState(false);
  const chatScrollRef = useRef(null);

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

  // Initialize Lenis smooth scroll
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.4,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: "vertical",
      gestureOrientation: "vertical",
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 1.5,
      infinite: false,
    });

    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    requestAnimationFrame(raf);

    return () => {
      lenis.destroy();
    };
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
    const updatedHistory = [...chatHistory, { sender: "user", text: userMsg }];
    setChatHistory(updatedHistory);
    setChatLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      // Build conversation history for context (last 6 messages)
      const conversationHistory = updatedHistory.slice(-6).map((msg) => ({
        role: msg.sender === "user" ? "user" : "assistant",
        content: msg.text
      }));

      const response = await axios.post(
        "http://localhost:5000/api/chat",
        { query: userMsg, history: conversationHistory },
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
          text: "⚠️ Sorry, I encountered an error. Please try again."
        }
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  // Auto-scroll chat to bottom on new messages
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatHistory, chatLoading]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const handleUrlChange = (e) => {
    const val = e.target.value;
    setNewUrl(val);
    if (!val.trim()) {
      setUrlError(null);
      return;
    }
    try {
      new URL(val);
      if (!val.startsWith("http://") && !val.startsWith("https://")) {
        setUrlError("Invalid URL type. Please use http or https.");
      } else {
        setUrlError(null);
      }
    } catch {
      setUrlError("Invalid URL type. Please enter a valid URL.");
    }
  };

  // Submit new Reel URL to start analysis pipeline
  const handleAddReel = async (e) => {
    if (e) e.preventDefault();
    if (!newUrl.trim() || urlError) return;

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

      toast.success("Successfully saved!", {
        description: "AI processing is running in the background.",
        duration: 5000,
      });

      setSubmitMessage(null);
      setNewUrl("");
      setIsImportOpen(false);

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
    <div className="min-h-screen bg-[#FAFAF8] dark:bg-[#0A0B0D] text-[#111111] dark:text-[#F2F2F0] font-sans selection:bg-[#111111] dark:selection:bg-[#F2F2F0] selection:text-[#F2F2F0] dark:selection:text-[#111111] transition-colors duration-200">

      {/* Top Navbar */}
      <nav className="sticky top-0 z-50 bg-[#FAFAF8]/95 dark:bg-[#0A0B0D]/95 backdrop-blur-md border-b border-[#E3E3DF] dark:border-[#1A1D22] px-6 py-4 flex items-center justify-between">
        {/* Left: Logo and Menu Trigger */}
        <div className="flex items-center gap-3">
          <Sheet open={leftSidebarOpen} onOpenChange={setLeftSidebarOpen}>
            <SheetTrigger asChild>
              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                className="flex items-center justify-center size-9 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-all text-[#111111] dark:text-[#F2F2F0] focus-visible:outline-none"
                aria-label="Open Navigation Menu"
              >
                <ListViewIcon isActive={leftSidebarOpen} className="text-[#111111] dark:text-[#F2F2F0] scale-110" />
              </motion.button>
            </SheetTrigger>
            <SheetContent side="left" onOpenAutoFocus={(e) => e.preventDefault()} className="sm:max-w-[320px] w-full p-6 flex flex-col bg-[#FAF9F5] dark:bg-[#090A0C] border-r border-[#111111]/5 dark:border-white/5 overflow-hidden">
              {/* Premium Film Grain Noise Overlay */}
              <div className="absolute inset-0 pointer-events-none opacity-[0.025] dark:opacity-[0.015] bg-[url('data:image/svg+xml;utf8,<svg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22><filter id=%22noise%22><feTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/></filter><rect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noise)%22/></svg>')] bg-repeat" />

              <motion.div
                className="h-full flex flex-col justify-between relative z-10"
                initial="hidden"
                animate={leftSidebarOpen ? "show" : "hidden"}
                variants={containerVariants}
                data-lenis-prevent
              >
                <div>
                  <motion.div variants={itemVariants} className="mb-8">
                    <SheetHeader>
                      <SheetTitle className="text-left font-heading italic font-normal text-[32px] tracking-[-0.04em] text-[#111111] dark:text-[#F2F2F0]">
                        SuperBrain
                      </SheetTitle>
                      <span className="text-[9px] font-mono uppercase tracking-[0.25em] text-[#111111]/45 dark:text-white/35 block -mt-2.5 ml-0.5">
                        Knowledge Curation
                      </span>
                    </SheetHeader>
                  </motion.div>

                  {/* Nav Items */}
                  <div className="space-y-6">
                    {/* Dashboard / Home */}
                    <motion.div variants={itemVariants}>
                      {activeCollectionId === null ? (
                        <div className="p-1 bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 rounded-[1.25rem]">
                          <motion.button
                            whileHover={{ scale: 1.01, x: 2 }}
                            whileTap={{ scale: 0.98 }}
                            transition={{ type: "spring", stiffness: 400, damping: 25 }}
                            onClick={() => {
                              setActiveCollectionId(null);
                              setLeftSidebarOpen(false);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 bg-[#111111] dark:bg-[#F2F2F0] text-[#FAFAF8] dark:text-[#111111] rounded-[calc(1.25rem-0.25rem)] shadow-sm font-medium text-[13px] tracking-wide"
                          >
                            <svg className="size-[15px] stroke-current" fill="none" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                            </svg>
                            <span>Dashboard</span>
                          </motion.button>
                        </div>
                      ) : (
                        <motion.button
                          whileHover={{ scale: 1.01, x: 2 }}
                          whileTap={{ scale: 0.98 }}
                          transition={{ type: "spring", stiffness: 400, damping: 25 }}
                          onClick={() => {
                            setActiveCollectionId(null);
                            setLeftSidebarOpen(false);
                          }}
                          className="w-full flex items-center gap-3 px-5 py-3 rounded-xl transition-all duration-350 text-[13px] font-medium text-black/55 dark:text-white/55 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5"
                        >
                          <svg className="size-[15px] stroke-current text-black/45 dark:text-white/45" fill="none" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                          </svg>
                          <span>Dashboard</span>
                        </motion.button>
                      )}
                    </motion.div>

                    {/* Collections List inside Drawer */}
                    <div className="space-y-4">
                      <motion.div variants={itemVariants} className="flex items-center justify-between px-5">
                        <span className="text-[10px] font-mono tracking-[0.25em] uppercase text-black/35 dark:text-white/30">Collections</span>
                        <motion.button
                          whileHover={{ scale: 1.04 }}
                          whileTap={{ scale: 0.96 }}
                          onClick={() => {
                            setLeftSidebarOpen(false);
                            setShowNewCollectionModal(true);
                          }}
                          className="px-2.5 py-0.5 border border-emerald-500/20 dark:border-emerald-400/20 rounded-full text-[9px] font-mono uppercase tracking-wider text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/5 dark:hover:bg-emerald-400/5 transition-all"
                        >
                          + Create
                        </motion.button>
                      </motion.div>

                      <div className="space-y-1.5 max-h-[280px] overflow-y-auto pr-1 scrollbar-none">
                        {collections.map((col, idx) => {
                          const isSelected = activeCollectionId === col.id;
                          const count = col.reel_collections?.length || 0;
                          return (
                            <motion.div
                              key={col.id}
                              variants={itemVariants}
                              custom={idx}
                              className="px-1"
                            >
                              {isSelected ? (
                                <div className="p-1 bg-emerald-500/[0.04] dark:bg-emerald-400/[0.04] border border-emerald-500/10 dark:border-emerald-400/20 rounded-xl">
                                  <motion.button
                                    whileHover={{ scale: 1.01, x: 2 }}
                                    whileTap={{ scale: 0.98 }}
                                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                                    onClick={() => {
                                      setActiveCollectionId(col.id);
                                      setLeftSidebarOpen(false);
                                    }}
                                    className="w-full flex items-center justify-between px-3 py-2 bg-transparent text-[#111111] dark:text-[#F2F2F0] font-semibold text-[13px]"
                                  >
                                    <div className="flex items-center gap-3">
                                      <svg className="size-[15px] stroke-emerald-500 dark:stroke-emerald-400" fill="none" strokeWidth="1.75" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h1.52c.314 0 .62.113.86.318l1.372 1.178c.24.205.546.318.86.318h6.138A2.25 2.25 0 0117.25 15v1.5M2.25 12.75a2.25 2.25 0 002.25 2.25h15a2.25 2.25 0 002.25-2.25M2.25 12.75V8.25A2.25 2.25 0 014.5 6h15A2.25 2.25 0 0121.75 8.25v4.5m0-4.5A2.25 2.25 0 0019.5 6h-6.138c-.314 0-.62-.113-.86-.318L11.13 4.503A2.25 2.25 0 0010.27 4.5H4.5A2.25 2.25 0 002.25 6.75v1.5" />
                                      </svg>
                                      <span className="truncate max-w-[170px]">{col.name}</span>
                                    </div>
                                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-emerald-500/10 dark:bg-emerald-400/10 text-emerald-600 dark:text-emerald-400">
                                      {count}
                                    </span>
                                  </motion.button>
                                </div>
                              ) : (
                                <motion.button
                                  whileHover={{ scale: 1.01, x: 2 }}
                                  whileTap={{ scale: 0.98 }}
                                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                                  onClick={() => {
                                    setActiveCollectionId(col.id);
                                    setLeftSidebarOpen(false);
                                  }}
                                  className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl transition-all duration-350 text-[13px] text-black/50 dark:text-white/55 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5"
                                >
                                  <div className="flex items-center gap-3">
                                    <svg className="size-[15px] stroke-black/35 dark:stroke-white/35" fill="none" strokeWidth="1.75" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h1.52c.314 0 .62.113.86.318l1.372 1.178c.24.205.546.318.86.318h6.138A2.25 2.25 0 0117.25 15v1.5M2.25 12.75a2.25 2.25 0 002.25 2.25h15a2.25 2.25 0 002.25-2.25M2.25 12.75V8.25A2.25 2.25 0 014.5 6h15A2.25 2.25 0 0121.75 8.25v4.5m0-4.5A2.25 2.25 0 0019.5 6h-6.138c-.314 0-.62-.113-.86-.318L11.13 4.503A2.25 2.25 0 0010.27 4.5H4.5A2.25 2.25 0 002.25 6.75v1.5" />
                                    </svg>
                                    <span className="truncate max-w-[175px]">{col.name}</span>
                                  </div>
                                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-black/[0.04] dark:bg-white/[0.04]">
                                    {count}
                                  </span>
                                </motion.button>
                              )}
                            </motion.div>
                          );
                        })}
                        {collections.length === 0 && (
                          <motion.p variants={itemVariants} className="text-[12px] text-[#6B7280] dark:text-[#8B93A1] italic px-5 py-2">
                            No collections yet.
                          </motion.p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Profile & Settings inside Drawer */}
                <div className="border-t border-[#111111]/5 dark:border-white/5 pt-6 space-y-4">
                  {/* Profile Info & Logout */}
                  <motion.div variants={itemVariants} className="px-1">
                    <div className="p-1.5 bg-[#111111]/[0.03] dark:bg-white/[0.03] border border-[#111111]/5 dark:border-white/5 rounded-[1.5rem]">
                      <div className="p-3 bg-[#FAF9F5] dark:bg-[#090A0C] border border-[#111111]/5 dark:border-white/5 rounded-[calc(1.5rem-0.375rem)] shadow-sm flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar className="size-9 border border-[#111111]/5 dark:border-white/5">
                            <AvatarFallback className="bg-black/5 dark:bg-white/5 text-[#111111] dark:text-[#F2F2F0] font-bold text-xs">
                              {userProfile.username[0]?.toUpperCase() || "U"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col truncate max-w-[110px]">
                            <span className="font-bold text-[13px] text-[#111111] dark:text-[#F2F2F0] truncate leading-none mb-1">
                              {userProfile.full_name || userProfile.username}
                            </span>
                            <span className="text-[9px] font-mono uppercase tracking-wider text-black/45 dark:text-white/45">
                              Personal Member
                            </span>
                          </div>
                        </div>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => {
                            setLeftSidebarOpen(false);
                            handleLogout();
                          }}
                          className="text-[9px] font-mono font-bold tracking-wider uppercase bg-red-500/10 hover:bg-red-500/15 text-red-500 hover:text-red-650 px-2.5 py-1.5 rounded-full transition-all"
                        >
                          Logout
                        </motion.button>
                      </div>
                    </div>
                  </motion.div>

                  {/* Settings Button */}
                  <motion.div variants={itemVariants}>
                    <motion.button
                      whileHover={{ scale: 1.01, x: 2 }}
                      whileTap={{ scale: 0.98 }}
                      transition={{ type: "spring", stiffness: 400, damping: 25 }}
                      onClick={() => {
                        toast.info("Settings panel integration coming soon!");
                        setLeftSidebarOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-5 py-3 rounded-xl transition-all duration-300 font-medium text-[13px] text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5"
                    >
                      <svg className="size-[15px] stroke-black/45 dark:stroke-white/45" fill="none" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span>Settings</span>
                    </motion.button>
                  </motion.div>
                </div>
              </motion.div>
            </SheetContent>
          </Sheet>

          <span className="text-[#111111] dark:text-[#F2F2F0] font-heading italic font-normal text-2xl tracking-[-0.03em] select-none ml-1">SuperBrain</span>
        </div>

        {/* Center: Search */}
        <div className="hidden md:flex flex-1 max-w-xl mx-8">
          <FaviconSearch
            placeholder="Search ideas, tools, transcripts..."
            value={searchQuery}
            onChange={(val) => {
              setSearchQuery(val);
              if (val.trim() === "") {
                setLastSearchedQuery("");
                setReels([]);
                fetchReels(1, "");
              }
            }}
            onSearch={(val) => {
              setReels([]);
              setLastSearchedQuery(val);
              fetchReels(1, val);
            }}
            className="w-full"
            inputClassName="w-full h-12 bg-[#F1F1EE] dark:bg-[#0E1013] border border-[#E3E3DF] dark:border-[#1A1D22] rounded-full focus-visible:ring-2 focus-visible:ring-[#111111] dark:focus-visible:ring-[#F2F2F0] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FAFAF8] dark:focus-visible:ring-offset-[#0A0B0D] text-[#111111] dark:text-[#F2F2F0] placeholder:text-[#6B7280] dark:placeholder:text-[#8B93A1]"
          />
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-4">
          <ThemeToggle />

          {/* Quick Import Dialog */}
          <Dialog open={isImportOpen} onOpenChange={(open) => {
            if (submitting) return;
            setIsImportOpen(open);
          }}>
            <DialogTrigger asChild>
              <Button className="group relative rounded-full bg-[#111111] dark:bg-[#F2F2F0] text-[#FAFAF8] dark:text-[#111111] h-[38px] pl-5 pr-1 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:scale-105 active:scale-[0.96] shadow-[0_4px_12px_rgba(0,0,0,0.1)] dark:shadow-[0_4px_12px_rgba(255,255,255,0.15)] border-none">
                <span className="mr-3 text-[15px] tracking-wide relative z-10 font-heading italic font-normal">Import Video</span>
                <div className="inline-flex items-center justify-center w-[30px] h-[30px] rounded-full bg-white/10 dark:bg-black/10 text-current transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:rotate-90">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
                </div>
              </Button>
            </DialogTrigger>
            <DialogContent
              onInteractOutside={(e) => { if (submitting) e.preventDefault(); }}
              onEscapeKeyDown={(e) => { if (submitting) e.preventDefault(); }}
              className={`sm:max-w-[480px] rounded-[2rem] p-8 bg-[#FAFAF8] dark:bg-[#050505]/60 backdrop-blur-3xl border border-black/5 dark:border-white/10 shadow-2xl dark:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.5)] transition-shadow duration-700 hover:shadow-[0_20px_80px_-20px_rgba(0,0,0,0.15)] dark:hover:shadow-[0_0_80px_-20px_rgba(255,255,255,0.12)] group ${submitting ? "[&>button]:hidden" : ""}`}
            >
              {/* Premium Hover Glow Effect */}
              <div className="pointer-events-none absolute inset-0 rounded-[2rem] opacity-0 transition-opacity duration-700 group-hover:opacity-100 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-black/[0.04] via-transparent to-transparent dark:from-white/[0.08]" />
              <DialogHeader className="relative z-10">
                {!submitting && (
                  <DialogTitle className="text-[28px] font-medium tracking-[-0.04em] text-center mb-6 text-[#111111] dark:text-[#F2F2F0]">
                    Save to SuperBrain
                  </DialogTitle>
                )}
              </DialogHeader>

              {submitting ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-8 animate-in fade-in zoom-in-95 duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]">
                  {/* Cinematic Scanner */}
                  <div className="relative w-32 h-32 flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full border border-black/10 dark:border-white/10"></div>
                    <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#111111] dark:border-t-[#F2F2F0] animate-[spin_3s_linear_infinite]"></div>
                    <div className="absolute inset-3 rounded-full border-2 border-transparent border-b-[#111111]/40 dark:border-b-[#F2F2F0]/40 animate-[spin_2s_reverse_linear_infinite]"></div>
                    <div className="absolute inset-8 bg-[#111111]/5 dark:bg-[#F2F2F0]/5 rounded-full animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite] backdrop-blur-md"></div>
                    <svg
                      className="w-10 h-10 text-[#111111] dark:text-[#F2F2F0] animate-pulse drop-shadow-[0_0_12px_rgba(17,17,17,0.3)] dark:drop-shadow-[0_0_12px_rgba(242,242,240,0.3)]"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
                      <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
                      <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4" />
                      <path d="M17.599 6.5a3 3 0 0 0 .399-1.375" />
                      <path d="M6.002 6.5A3 3 0 0 1 5.603 5.125" />
                      <path d="M11.8 21.271A3 3 0 0 0 12 21.5a3 3 0 0 0 .2-.229" />
                    </svg>
                  </div>

                  {/* Progress Copy */}
                  <div className="text-center space-y-3">
                    <h4 className="text-[28px] font-serif italic font-medium tracking-[-0.04em] text-[#111111] dark:text-[#F2F2F0]">Extracting Intelligence</h4>
                    <p className="text-[14px] text-[#6B7280] dark:text-[#8B93A1] max-w-[280px] mx-auto leading-relaxed">
                      Transcribing audio, parsing visual context, and generating vector embeddings. This usually takes a minute...
                    </p>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleAddReel} className="flex flex-col gap-6 animate-in fade-in duration-500">
                  <div className="relative">
                    <Input
                      type="text"
                      placeholder="Paste Instagram Reel or Video URL..."
                      className={`rounded-[1.25rem] h-16 px-6 bg-black/[0.03] dark:bg-white/5 backdrop-blur-md border focus-visible:ring-0 text-[15px] text-[#111111] dark:text-[#F2F2F0] shadow-inner transition-all placeholder:text-[#6B7280]/60 dark:placeholder:text-[#8B93A1]/60 relative z-10 ${urlError ? "border-red-500/50 focus-visible:border-red-500/80" : "border-black/5 dark:border-white/10 focus-visible:border-black/20 dark:focus-visible:border-white/30"}`}
                      value={newUrl}
                      onChange={handleUrlChange}
                      disabled={submitting}
                    />
                    {urlError && (
                      <p className="absolute -bottom-6 left-4 text-[12px] text-red-500 font-medium">
                        {urlError}
                      </p>
                    )}
                  </div>
                  <div className={(submitting || urlError || !newUrl.trim()) ? "opacity-50 pointer-events-none mt-4" : "mt-4"}>
                    <button
                      onClick={(e) => handleAddReel(e)}
                      disabled={!!urlError || !newUrl.trim() || submitting}
                      type="button"
                      className="group w-full h-16 rounded-[1.25rem] bg-[#111111] dark:bg-white text-[#FAFAF8] dark:text-[#111111] shadow-[0_4px_20px_rgba(0,0,0,0.15)] transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:scale-[1.01] active:scale-[0.98] border border-transparent dark:border-white/10 flex items-center justify-center relative overflow-hidden"
                    >
                      <span className="text-[16px] font-bold tracking-wide z-10">Save to Library</span>
                      <div className="ml-3 w-8 h-8 rounded-full bg-white/10 dark:bg-black/10 flex items-center justify-center transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-1 group-hover:scale-105 z-10">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                      </div>
                      <div className="absolute inset-0 bg-white/10 dark:bg-black/10 translate-y-full transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-y-0" />
                    </button>
                  </div>
                  {submitMessage && <p className="text-sm text-center text-[#111111] dark:text-[#F2F2F0] mt-2">{submitMessage}</p>}
                  {submitError && <p className="text-[13px] text-center text-red-500/90 font-medium bg-red-500/10 py-3 rounded-xl border border-red-500/20">{submitError}</p>}
                </form>
              )}
            </DialogContent>
          </Dialog>

          {/* Profile Dropdown (simplified to Avatar for now) */}
          <div className="flex items-center gap-2 cursor-pointer" onClick={handleLogout} title="Click to logout">
            <Avatar className="h-10 w-10 border border-[#E3E3DF] dark:border-[#1A1D22]">
              <AvatarFallback className="bg-[#F1F1EE] dark:bg-[#0E1013] text-[#111111] dark:text-[#F2F2F0] font-heading italic text-xl pt-0.5">
                {userProfile.username[0]?.toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>
      </nav>

      <main className="max-w-[1440px] mx-auto px-6 py-6">

        {/* Categories / Filter Chips */}
        <div className="flex items-center justify-center mb-12">
          <ScrollArea className="w-full max-w-4xl whitespace-nowrap">
            <div className="flex items-center justify-start md:justify-center px-4 pb-4">
              <div className="inline-flex p-1.5 bg-[#F1F1EE]/80 dark:bg-[#0E1013]/80 backdrop-blur-xl border border-black/5 dark:border-white/5 rounded-full shadow-[0_8px_24px_rgba(0,0,0,0.03)] dark:shadow-none">
                {tabs.map((tab) => {
                  const isActive = activeTab === tab;
                  return (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`relative px-6 py-2.5 rounded-full text-[13px] font-bold tracking-wide transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.95] ${isActive
                        ? "bg-[#111111] dark:bg-[#F2F2F0] text-[#FAFAF8] dark:text-[#111111] shadow-md"
                        : "text-[#6B7280] dark:text-[#8B93A1] hover:text-[#111111] dark:hover:text-[#F2F2F0] hover:bg-black/5 dark:hover:bg-white/5"
                        }`}
                    >
                      {tab}
                    </button>
                  );
                })}
              </div>
            </div>
            <ScrollBar orientation="horizontal" className="hidden" />
          </ScrollArea>
        </div>

        {/* Active Collection Filter Indicator */}
        {activeCollectionId && (
          <div className="mb-6 flex items-center justify-between px-3 py-2.5 bg-[#F1F1EE]/40 dark:bg-[#0E1013]/40 border border-black/5 dark:border-white/5 rounded-2xl max-w-max animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex items-center gap-3">
              <span className="text-[12px] font-medium tracking-tight text-[#111111] dark:text-[#F2F2F0]">
                Viewing 📂 <span className="font-bold">{collections.find(c => c.id === activeCollectionId)?.name}</span>
              </span>
              <button
                onClick={() => setActiveCollectionId(null)}
                className="text-[10px] font-mono tracking-wider uppercase text-red-500 hover:text-red-650 dark:hover:text-red-400 hover:underline flex items-center justify-center p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/5"
              >
                Clear Filter [×]
              </button>
            </div>
          </div>
        )}

        {/* Create Collection Dialog */}
        <Dialog open={showNewCollectionModal} onOpenChange={setShowNewCollectionModal}>
          <DialogContent className="sm:max-w-[420px] rounded-[2rem] p-8 bg-[#FAFAF8] dark:bg-[#050505]/60 backdrop-blur-3xl border border-black/5 dark:border-white/10 shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-[24px] font-medium tracking-[-0.03em] text-[#111111] dark:text-[#F2F2F0] mb-4">
                Create New Collection
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateCollection} className="flex flex-col gap-6">
              <Input
                type="text"
                placeholder="Collection Name (e.g. Inspiration, Design)..."
                className="rounded-xl h-12 px-4 bg-black/[0.03] dark:bg-white/5 border border-black/5 dark:border-white/10 focus-visible:ring-0 text-[14px]"
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                disabled={creatingCollection}
                autoFocus
              />
              <div className="flex justify-end gap-3 font-mono text-[11px] uppercase tracking-wider">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowNewCollectionModal(false)}
                  className="rounded-lg h-10 px-4"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={creatingCollection || !newCollectionName.trim()}
                  className="rounded-lg h-10 px-5 bg-[#111111] dark:bg-[#F2F2F0] text-[#FAFAF8] dark:text-[#111111] font-bold"
                >
                  {creatingCollection ? "Creating..." : "Create"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Grid Area */}
        {loading && currentPage === 1 ? (
          <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 lg:columns-5 xl:columns-6 gap-4 [column-fill:balance]">
            {["h-[280px]", "h-[380px]", "h-[320px]", "h-[260px]", "h-[420px]", "h-[290px]", "h-[360px]", "h-[310px]", "h-[270px]", "h-[390px]", "h-[330px]", "h-[280px]"].map((hClass, idx) => (
              <div
                key={idx}
                className={`break-inside-avoid mb-4 w-full rounded-[1.5rem] overflow-hidden border border-black/5 dark:border-white/5 bg-[#F1F1EE] dark:bg-[#0E1013] ${hClass} relative animate-pulse`}
              >
                <div className="absolute top-4 left-4 w-16 h-6 rounded-full bg-black/[0.05] dark:bg-white/[0.05]"></div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center my-20">
            <p className="text-red-500 font-semibold">{error}</p>
            <Button variant="link" onClick={() => fetchReels(currentPage)} className="mt-4 text-[#111111] dark:text-[#F2F2F0]">Retry Connection</Button>
          </div>
        ) : filteredReels.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 px-4 text-center">
            <div className="w-12 h-[2px] bg-[#111111]/20 dark:bg-[#F2F2F0]/20 mb-6 rounded-full"></div>
            <h3 className="font-medium text-[32px] md:text-[40px] leading-[1.1] tracking-[-0.03em] text-[#111111] dark:text-[#F2F2F0] mb-4">
              Nothing saved yet
            </h3>
            <p className="text-[15px] text-[#6B7280] dark:text-[#8B93A1] tracking-tight max-w-sm">
              Your personal intelligence repository is empty. Import a video URL to begin extracting knowledge.
            </p>
          </div>
        ) : (
          <motion.div
            layout
            className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 lg:columns-5 xl:columns-6 gap-4 [column-fill:balance]"
          >
            <AnimatePresence mode="popLayout">
              {filteredReels.map((reel) => (
                <motion.div
                  layout
                  key={reel.id}
                  initial={{ opacity: 0, scale: 0.92, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.92, y: 12 }}
                  transition={{
                    opacity: { duration: 0.3 },
                    layout: { type: "spring", stiffness: 350, damping: 32 },
                    scale: { duration: 0.3, ease: "easeOut" },
                    y: { type: "spring", stiffness: 300, damping: 28 }
                  }}
                  className="break-inside-avoid mb-4"
                >
                  <ReelCard
                    reel={reel}
                    collections={collections}
                    onRefreshCollections={fetchCollections}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Infinite Scroll Loader */}
        {loading && currentPage > 1 && (
          <div className="flex justify-center my-8">
            <div className="w-8 h-8 border-4 border-[#111111] dark:border-[#F2F2F0] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

      </main>

      {/* Floating Action Button: AI Assistant */}
      <Sheet open={chatOpen} onOpenChange={setChatOpen}>
        <SheetTrigger asChild>
          <Button
            className="fixed bottom-8 right-8 z-40 rounded-full h-14 w-14 shadow-xl bg-[#FAFAF8] dark:bg-[#F2F2F0] border border-[#E3E3DF] dark:border-transparent text-[#111111] dark:text-[#111111] hover:bg-[#F1F1EE] dark:hover:bg-[#D4D4D8] transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </Button>
        </SheetTrigger>
        <SheetContent className="sm:max-w-[450px] w-full p-6 flex flex-col bg-[#FAFAF8] dark:bg-[#0A0B0D] border-l border-[#E3E3DF] dark:border-[#1A1D22]">
          <SheetHeader>
            <div className="flex items-center justify-between py-2">
              <SheetTitle className="font-heading font-normal italic text-[28px] text-[#111111] dark:text-[#F2F2F0]">
                SuperBrain AI
              </SheetTitle>
              {chatHistory.length > 1 && (
                <button
                  onClick={() => setChatHistory([{ sender: "ai", text: "Hi! I am SuperBrain Assistant. Ask me anything about your saved product reviews, tools, how-to guides, and tutorials." }])}
                  className="text-[11px] font-mono uppercase tracking-wider text-[#6B7280] dark:text-[#8B93A1] hover:text-red-500 dark:hover:text-red-400 transition-colors px-2 py-1 rounded-lg hover:bg-red-500/5"
                >
                  Clear
                </button>
              )}
            </div>
          </SheetHeader>

          {/* Message List */}
          <div ref={chatScrollRef} className="flex-1 overflow-y-auto space-y-4 py-4 pr-1" data-lenis-prevent>
            {chatHistory.map((msg, index) => (
              <div key={index} className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}>
                <div className={`max-w-[88%] rounded-2xl px-4 py-3 ${
                  msg.sender === "user"
                    ? "bg-[#111111] dark:bg-[#F2F2F0] text-[#F2F2F0] dark:text-[#111111]"
                    : "bg-white dark:bg-[#0E1013] border border-[#E3E3DF] dark:border-[#1A1D22] text-[#111111] dark:text-[#F2F2F0] shadow-sm"
                }`}>
                  {msg.sender === "user" ? (
                    <p className="text-[14px] leading-relaxed">{msg.text}</p>
                  ) : (
                    <div className="text-[14px] leading-relaxed prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-headings:font-semibold prose-headings:my-2 prose-ul:my-1 prose-li:my-0.5 prose-a:text-emerald-600 dark:prose-a:text-emerald-400 prose-code:bg-black/5 dark:prose-code:bg-white/10 prose-code:rounded prose-code:px-1 prose-code:text-[12px]">
                      <ReactMarkdown>{msg.text}</ReactMarkdown>
                    </div>
                  )}

                  {/* Citations */}
                  {msg.references && msg.references.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-black/10 dark:border-white/10 space-y-1.5">
                      <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-[#6B7280] dark:text-[#8B93A1]">Sources</p>
                      <div className="flex flex-col gap-1.5">
                        {msg.references.map((ref) => (
                          <a
                            key={ref.id}
                            href={`/imports/${ref.id}`}
                            className="inline-flex items-center gap-2 text-[12px] font-medium text-[#111111] dark:text-[#F2F2F0] bg-black/[0.04] dark:bg-white/[0.04] hover:bg-black/[0.08] dark:hover:bg-white/[0.08] border border-black/5 dark:border-white/5 px-3 py-2 rounded-xl transition-colors"
                          >
                            <svg className="w-3 h-3 shrink-0 text-emerald-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                            <span className="truncate max-w-[220px]">{ref.title}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {chatLoading && (
              <div className="bg-white dark:bg-[#0E1013] border border-[#E3E3DF] dark:border-[#1A1D22] shadow-sm rounded-2xl px-5 py-4 w-max">
                <span className="flex items-center space-x-1.5">
                  <span className="w-1.5 h-1.5 bg-[#6B7280] dark:bg-[#8B93A1] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-[#6B7280] dark:bg-[#8B93A1] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-[#6B7280] dark:bg-[#8B93A1] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
              </div>
            )}
          </div>

          {/* Input */}
          <form onSubmit={handleSendQuery} className="mt-2 relative">
            <Input
              type="text"
              placeholder="Ask anything..."
              className="w-full pl-5 pr-14 h-14 rounded-full bg-[#F1F1EE] dark:bg-[#0E1013] border border-[#E3E3DF] dark:border-[#1A1D22] focus-visible:ring-2 focus-visible:ring-[#111111] dark:focus-visible:ring-[#F2F2F0] text-[14px] text-[#111111] dark:text-[#F2F2F0] placeholder:text-[#6B7280] dark:placeholder:text-[#8B93A1]"
              value={chatQuery}
              onChange={(e) => setChatQuery(e.target.value)}
              disabled={chatLoading}
            />
            <Button
              type="submit"
              size="icon"
              disabled={chatLoading || !chatQuery.trim()}
              className="absolute right-2 top-2 rounded-full h-10 w-10 bg-[#111111] hover:bg-[#333333] dark:bg-[#F2F2F0] dark:hover:bg-[#D4D4D8] text-[#FAFAF8] dark:text-[#111111] transition-colors disabled:opacity-40"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
            </Button>
          </form>
        </SheetContent>
      </Sheet>

    </div>
  );
}
