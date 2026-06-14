import React, { useState, useEffect, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { supabase } from "../utils/supabaseClient";
import ThemeToggle from "../components/ThemeToggle";
import MindMapModal from "../components/MindMapModal";
import { Button } from "../components/ui/button";
import { PrimeButton } from "../components/satisui/prime-button";
import { FluidGradientText } from "../components/fluid-gradient-text";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../components/ui/tooltip";
import { Edit3, Brain, Download, Trash2, FileText, Printer, X } from "lucide-react";
import Lenis from "lenis";

export default function ReelDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [reel, setReel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [visualOpen, setVisualOpen] = useState(false);
  const [showMindMap, setShowMindMap] = useState(false);

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

  // Export dropdown & click outside references
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const exportDropdownRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(event.target)) {
        setShowExportDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Edit / Curation state
  const [editMode, setEditMode] = useState(false);
  const [notes, setNotes] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [takeawaysInput, setTakeawaysInput] = useState("");
  const [saveStatus, setSaveStatus] = useState("idle");

  useEffect(() => {
    if (reel && reel.reel_metadata) {
      setNotes(reel.reel_metadata.notes || "");
      setTagsInput((reel.reel_metadata.tags || []).join(", "));
      setTakeawaysInput((reel.reel_metadata.key_takeaways || []).join("\n"));
    }
  }, [reel]);

  useEffect(() => {
    const fetchReelDetails = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;

        if (!token) {
          setError("Session expired. Please log in again.");
          setLoading(false);
          return;
        }

        const response = await axios.get(`http://localhost:5000/api/reels/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        setReel(response.data);
      } catch (err) {
        console.error("Error fetching reel details:", err);
        setError(err.response?.data?.error || "Failed to retrieve this item.");
      } finally {
        setLoading(false);
      }
    };

    fetchReelDetails();
  }, [id]);

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this analyzed import? All metadata and transcription files will be permanently removed.")) {
      return;
    }

    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      await axios.delete(`http://localhost:5000/api/reels/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      navigate("/dashboard");
    } catch (err) {
      console.error("Error deleting reel:", err);
      alert(err.response?.data?.error || "Failed to delete the import.");
      setDeleting(false);
    }
  };

  const handleSaveMetadata = async () => {
    setSaveStatus("loading");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setSaveStatus("error");
        setTimeout(() => {
          setSaveStatus("idle");
        }, 1500);
        return;
      }

      const formattedTags = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      const formattedTakeaways = takeawaysInput
        .split("\n")
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      const response = await axios.patch(
        `http://localhost:5000/api/reels/${id}/metadata`,
        {
          notes: notes,
          tags: formattedTags,
          keyTakeaways: formattedTakeaways
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setReel((prev) => ({
        ...prev,
        reel_metadata: {
          ...prev.reel_metadata,
          notes: response.data.notes,
          tags: response.data.tags,
          key_takeaways: response.data.key_takeaways
        }
      }));
      setSaveStatus("success");
      setTimeout(() => {
        setEditMode(false);
        setSaveStatus("idle");
      }, 1500);
    } catch (err) {
      console.error("Error updating metadata:", err);
      setSaveStatus("error");
      setTimeout(() => {
        setSaveStatus("idle");
      }, 1500);
    }
  };

  const exportMarkdown = () => {
    if (!reel) return;
    const metadata = reel.reel_metadata || {};
    const transcript = reel.transcripts || {};

    let md = `# ${metadata.title || "SuperBrain Saved Reel"}\n\n`;
    md += `- **Instagram URL**: ${reel.instagram_url}\n`;
    md += `- **Author**: @${reel.author_username || "unknown"}\n`;
    md += `- **Analyzed at**: ${reel.analyzed_at ? new Date(reel.analyzed_at).toLocaleString() : "N/A"}\n\n`;

    md += `## Executive Summary\n\n${metadata.summary || "No summary available."}\n\n`;

    md += `## Key Takeaways\n\n`;
    if (metadata.key_takeaways && metadata.key_takeaways.length > 0) {
      metadata.key_takeaways.forEach((k, idx) => {
        md += `${idx + 1}. ${k}\n`;
      });
    } else {
      md += "*No takeaways.*\n";
    }
    md += `\n`;

    md += `## Mentioned Tools & Brands\n\n`;
    if (metadata.mentioned_tools && metadata.mentioned_tools.length > 0) {
      metadata.mentioned_tools.forEach((t) => {
        md += `- **${t}**\n`;
      });
    } else {
      md += "*No tools detected.*\n";
    }
    md += `\n`;

    md += `## Extracted Resources\n\n`;
    const resources = reel.resources || [];
    if (resources.length > 0) {
      resources.forEach((res) => {
        md += `### ${res.resource_name} (${res.resource_type})\n`;
        if (res.resource_url) {
          md += `- **URL**: [${res.resource_url}](${res.resource_url})\n`;
        }
        md += `- **Confidence**: ${Math.round(res.confidence)}%\n`;
        md += `- **Verification Status**: ${res.verification_status}\n`;
        md += `- **Hallucination Flag**: ${res.hallucination_flag ? "YES" : "NO"}\n`;
        if (res.description) {
          md += `- **Description**: ${res.description}\n`;
        }
        if (res.evidence_text) {
          md += `- **Evidence Context**: "${res.evidence_text}"\n`;
        }
        if (res.timestamp_start) {
          md += `- **Timestamp**: ${res.timestamp_start}\n`;
        }
        md += `\n`;
      });
    } else if (metadata.extracted_urls && metadata.extracted_urls.length > 0) {
      metadata.extracted_urls.forEach((url) => {
        md += `- [${url}](${url})\n`;
      });
    } else {
      md += "*No resources extracted.*\n";
    }
    md += `\n`;

    md += `## Personal Curation Notes\n\n${metadata.notes || "*No curation notes yet. Edit this item to add notes.*"}\n\n`;

    md += `## Audio Transcript\n\n${transcript.plain_text || "*No audio transcript available.*"}\n`;

    const blob = new Blob([md], { type: "text/markdown;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${(metadata.title || "superbrain-export").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] dark:bg-[#050505] text-[#111111] dark:text-[#F2F2F0] font-sans transition-colors duration-500 relative">
        {/* Glow */}
        <div className="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 w-[80vw] h-[80vh] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-black/[0.02] via-transparent to-transparent dark:from-white/[0.04] rounded-full blur-[100px] z-0" />

        {/* Skeleton Header */}
        <div className="max-w-7xl mx-auto px-6 pt-8 relative z-10">
          <header className="p-1 rounded-full bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/10 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.2)]">
            <div className="bg-white dark:bg-[#0c0c0c] rounded-full px-6 py-3 flex items-center justify-between border border-white dark:border-white/5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.6)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]">
              <div className="flex items-center gap-4">
                <span className="text-xs font-mono text-black/40 dark:text-white/40 flex items-center gap-1">
                  &lt; Back
                </span>
                <div className="h-4 w-px bg-black/10 dark:bg-white/10" />
                <div className="h-3.5 w-32 bg-black/10 dark:bg-white/10 rounded-full animate-pulse" />
              </div>
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 bg-black/10 dark:bg-white/10 rounded-full animate-pulse" />
                <div className="h-8 w-8 bg-black/10 dark:bg-white/10 rounded-full animate-pulse" />
                <div className="h-8 w-8 bg-black/10 dark:bg-white/10 rounded-full animate-pulse" />
              </div>
            </div>
          </header>
        </div>

        {/* Skeleton Main Grid */}
        <div className="relative z-10 max-w-7xl mx-auto px-6 py-24 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20 items-start">
          {/* LEFT COLUMN: Media Panel */}
          <section className="lg:col-span-5 lg:sticky lg:top-32 space-y-8">
            <div className="p-1.5 rounded-[2.5rem] bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 backdrop-blur-xl">
              <div className="bg-[#FAFAF8] dark:bg-[#080808] rounded-[2.1rem] overflow-hidden border border-white dark:border-white/5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.6)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] p-6 space-y-6">
                <div className="aspect-[9/16] max-h-[480px] w-full bg-black/10 dark:bg-white/10 rounded-3xl animate-pulse" />

                <div className="space-y-4">
                  <div className="h-4 w-24 bg-black/10 dark:bg-white/10 rounded-full animate-pulse" />
                  <div className="h-6 w-3/4 bg-black/10 dark:bg-white/10 rounded-full animate-pulse" />

                  <div className="flex gap-2 pt-2">
                    <div className="h-5 w-16 bg-black/10 dark:bg-white/10 rounded-full animate-pulse" />
                    <div className="h-5 w-20 bg-black/10 dark:bg-white/10 rounded-full animate-pulse" />
                    <div className="h-5 w-14 bg-black/10 dark:bg-white/10 rounded-full animate-pulse" />
                  </div>

                  <hr className="border-black/5 dark:border-white/5" />

                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-black/10 dark:bg-white/10 rounded-full animate-pulse" />
                    <div className="space-y-1.5 flex-1">
                      <div className="h-3 w-1/3 bg-black/10 dark:bg-white/10 rounded-full animate-pulse" />
                      <div className="h-3.5 w-1/2 bg-black/10 dark:bg-white/10 rounded-full animate-pulse" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* RIGHT COLUMN: Intelligence Panels */}
          <section className="lg:col-span-7 space-y-16 pt-4 lg:pt-0">
            {/* Summary Skeleton */}
            <div className="p-1.5 rounded-[2rem] bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 backdrop-blur-xl">
              <div className="bg-[#FAFAF8] dark:bg-[#080808] rounded-[1.6rem] p-8 sm:p-10 border border-white dark:border-white/5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.6)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] space-y-6">
                <div className="h-3 w-32 bg-black/10 dark:bg-white/10 rounded-full animate-pulse" />
                <div className="space-y-3">
                  <div className="h-4 w-full bg-black/10 dark:bg-white/10 rounded-full animate-pulse" />
                  <div className="h-4 w-full bg-black/10 dark:bg-white/10 rounded-full animate-pulse" />
                  <div className="h-4 w-5/6 bg-black/10 dark:bg-white/10 rounded-full animate-pulse" />
                </div>
              </div>
            </div>

            {/* Takeaways Skeleton */}
            <div className="pl-4 sm:pl-8 border-l border-black/10 dark:border-white/10 py-2 space-y-6">
              <div className="h-3 w-28 bg-black/10 dark:bg-white/10 rounded-full animate-pulse" />
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex gap-4 items-center">
                    <div className="h-3.5 w-6 bg-black/10 dark:bg-white/10 rounded-full animate-pulse" />
                    <div className="h-4 w-5/6 bg-black/10 dark:bg-white/10 rounded-full animate-pulse" />
                  </div>
                ))}
              </div>
            </div>

            {/* Tools & Resources Skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="p-1.5 rounded-[2rem] bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 backdrop-blur-xl">
                <div className="bg-[#FAFAF8] dark:bg-[#080808] rounded-[1.6rem] p-6 border border-white dark:border-white/5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.6)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] space-y-4">
                  <div className="h-3 w-24 bg-black/10 dark:bg-white/10 rounded-full animate-pulse" />
                  <div className="flex flex-wrap gap-2">
                    <div className="h-6 w-16 bg-black/10 dark:bg-white/10 rounded-full animate-pulse" />
                    <div className="h-6 w-24 bg-black/10 dark:bg-white/10 rounded-full animate-pulse" />
                    <div className="h-6 w-20 bg-black/10 dark:bg-white/10 rounded-full animate-pulse" />
                  </div>
                </div>
              </div>

              <div className="p-1.5 rounded-[2rem] bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 backdrop-blur-xl">
                <div className="bg-[#FAFAF8] dark:bg-[#080808] rounded-[1.6rem] p-6 border border-white dark:border-white/5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.6)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] space-y-4">
                  <div className="h-3 w-28 bg-black/10 dark:bg-white/10 rounded-full animate-pulse" />
                  <div className="space-y-2.5">
                    <div className="h-4 w-3/4 bg-black/10 dark:bg-white/10 rounded-full animate-pulse" />
                    <div className="h-3.5 w-1/2 bg-black/10 dark:bg-white/10 rounded-full animate-pulse" />
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    );
  }

  if (error || !reel) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-[#0a0a0a] text-neutral-900 dark:text-neutral-100 flex items-center justify-center p-6 transition-colors duration-200">
        <div className="max-w-md w-full bg-white dark:bg-[#0d0d0d] border border-neutral-200 dark:border-[#222] p-8 text-center rounded-[3px]">
          <p className="text-sm text-rose-600 dark:text-rose-400 font-mono mb-6">{error || "Requested import was not found."}</p>
          <Link
            to="/dashboard"
            className="text-xs font-mono bg-neutral-900 dark:bg-emerald-500 hover:bg-neutral-800 dark:hover:bg-emerald-400 text-white dark:text-black border border-neutral-800 dark:border-transparent px-4 py-2 rounded-[3px] transition-colors"
          >
            &lt; Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // Deconstruct elements
  const metadata = reel.reel_metadata || {};
  const transcript = reel.transcripts || {};

  const keyTakeaways = metadata.key_takeaways || [];
  const tags = metadata.tags || [];
  const tools = metadata.mentioned_tools || [];
  const urls = metadata.extracted_urls || [];

  return (
    <div className="min-h-screen bg-[#FAFAF8] dark:bg-[#050505] text-[#111111] dark:text-[#F2F2F0] font-sans selection:bg-black/10 dark:selection:bg-white/20 transition-colors duration-500 relative overflow-hidden">
      {/* Ambient glowing orb for background */}
      <div className="pointer-events-none fixed top-[-20%] left-1/2 -translate-x-1/2 w-[80vw] h-[80vh] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-black/[0.03] via-transparent to-transparent dark:from-white/[0.06] rounded-full blur-[100px] z-0" />

      {/* Detail Header / Nav bar - Floating Glass Pill */}
      <header className="sticky top-6 z-50 mx-auto max-w-7xl px-6 flex items-center justify-between transition-colors duration-500">
        <div className="flex items-center gap-4 bg-white/70 dark:bg-[#111111]/70 backdrop-blur-3xl px-5 py-3 rounded-full border border-black/5 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)]">
          <Link
            to="/dashboard"
            className="group flex items-center gap-2 text-[10px] uppercase tracking-[0.1em] font-medium text-black/50 hover:text-black dark:text-white/50 dark:hover:text-white transition-colors"
          >
            <span className="group-hover:-translate-x-1 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]">←</span> BACK TO DASHBOARD
          </Link>
          <div className="h-4 w-px bg-black/10 dark:bg-white/10" />
          <span className="text-[10px] uppercase tracking-wider font-mono text-black/30 dark:text-white/30 truncate max-w-[150px] md:max-w-xs">
            ID: {reel.id.split('-')[0]}
          </span>
        </div>

        <div className="flex items-center gap-1.5 bg-white/70 dark:bg-[#111111]/70 backdrop-blur-3xl p-1.5 rounded-full border border-black/5 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] no-print">
          <ThemeToggle />

          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setEditMode(!editMode)}
                  className={`rounded-full h-9 w-9 transition-all duration-300 ${editMode ? "bg-black/5 dark:bg-white/10 text-black dark:text-white" : "text-black/50 dark:text-white/50 hover:bg-black/5 dark:hover:bg-white/10 hover:text-black dark:hover:text-white"}`}
                >
                  {editMode ? <X size={15} strokeWidth={2} /> : <Edit3 size={15} strokeWidth={2} />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="px-3 py-1.5 text-[10px] uppercase tracking-wider rounded-full border-black/5 dark:border-white/10">
                {editMode ? "Cancel Editing" : "Edit Curation"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowMindMap(true)}
                  className="rounded-full h-9 w-9 text-black/50 dark:text-white/50 hover:bg-black/5 dark:hover:bg-white/10 hover:text-black dark:hover:text-white transition-all duration-300"
                >
                  <Brain size={15} strokeWidth={2} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="px-3 py-1.5 text-[10px] uppercase tracking-wider rounded-full border-black/5 dark:border-white/10">Visual Mind Map</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <div className="relative" ref={exportDropdownRef}>
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowExportDropdown(!showExportDropdown)}
                    className={`rounded-full h-9 w-9 transition-all duration-300 ${showExportDropdown ? "bg-black/5 dark:bg-white/10 text-black dark:text-white" : "text-black/50 dark:text-white/50 hover:bg-black/5 dark:hover:bg-white/10 hover:text-black dark:hover:text-white"}`}
                  >
                    <Download size={15} strokeWidth={2} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="px-3 py-1.5 text-[10px] uppercase tracking-wider rounded-full border-black/5 dark:border-white/10">Export Analysis</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {showExportDropdown && (
              <div className="absolute right-0 mt-3 w-56 p-1.5 bg-white/90 dark:bg-[#111111]/90 backdrop-blur-2xl border border-black/5 dark:border-white/10 rounded-[1.25rem] shadow-[0_20px_40px_-10px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.4)] z-50 animate-in fade-in zoom-in-95 duration-200">
                <button
                  onClick={() => { exportMarkdown(); setShowExportDropdown(false); }}
                  className="w-full text-left px-4 py-2.5 rounded-xl text-[11px] uppercase tracking-wider font-medium flex items-center gap-3 text-black/70 dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/10 hover:text-black dark:hover:text-white transition-colors"
                >
                  <FileText size={14} />
                  Export Markdown
                </button>
                <button
                  onClick={() => { window.print(); setShowExportDropdown(false); }}
                  className="w-full text-left px-4 py-2.5 rounded-xl text-[11px] uppercase tracking-wider font-medium flex items-center gap-3 text-black/70 dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/10 hover:text-black dark:hover:text-white transition-colors"
                >
                  <Printer size={14} />
                  Print / Save PDF
                </button>
              </div>
            )}
          </div>

          <div className="w-px h-4 bg-black/10 dark:bg-white/10 mx-1" />

          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={deleting}
                  onClick={handleDelete}
                  className="rounded-full h-9 w-9 text-rose-500/70 hover:bg-rose-500/10 hover:text-rose-500 transition-all duration-300 disabled:opacity-50"
                >
                  <Trash2 size={15} strokeWidth={2} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="px-3 py-1.5 text-[10px] uppercase tracking-wider rounded-full border-black/5 dark:border-white/10 text-rose-500">
                {deleting ? "Deleting..." : "Delete Curation"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </header>

      {/* Main Grid: Asymmetric Split */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 pt-24 pb-44 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20 items-start">

        {/* LEFT COLUMN (Media Info Panel) - Sticky */}
        <section className="lg:col-span-5 relative group z-10 lg:sticky lg:top-32">
          {/* Double-Bezel Architecture */}
          <div className="p-2 rounded-[2.5rem] bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 backdrop-blur-2xl transition-shadow duration-700 hover:shadow-[0_40px_100px_-20px_rgba(0,0,0,0.1)] dark:hover:shadow-[0_40px_100px_-20px_rgba(255,255,255,0.05)]">
            <div className="relative bg-[#FAFAF8] dark:bg-[#080808] rounded-[2rem] p-6 sm:p-8 border border-white dark:border-white/5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.6)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] h-full flex flex-col gap-8">

              <div className="relative aspect-[4/5] w-full bg-black/5 dark:bg-[#111111] overflow-hidden rounded-[1.5rem] shadow-inner">
                {reel.thumbnail_url ? (
                  <img
                    src={reel.thumbnail_url}
                    alt={metadata.title || "Visual preview"}
                    className="w-full h-full object-cover transition-transform duration-[1.5s] group-hover:scale-[1.02] ease-[cubic-bezier(0.32,0.72,0,1)]"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-black/30 dark:text-white/30 text-[10px] uppercase tracking-widest font-mono">
                    NO PREVIEW
                  </div>
                )}

                {metadata.content_type && (
                  <span className="absolute top-4 right-4 px-3 py-1 text-[9px] font-mono tracking-widest uppercase bg-white/90 dark:bg-black/60 backdrop-blur-md text-black dark:text-white border border-black/5 dark:border-white/10 rounded-full shadow-sm">
                    {metadata.content_type}
                  </span>
                )}
              </div>

              <div className="space-y-6">
                <div className="flex justify-between items-end border-b border-black/5 dark:border-white/5 pb-6">
                  <div>
                    <h4 className="text-[9px] font-medium uppercase tracking-[0.2em] text-black/40 dark:text-white/40 mb-2">Source</h4>
                    <div>
                      {reel.author_username ? (
                        <a
                          href={`https://instagram.com/${reel.author_username}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1 border border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] hover:bg-black/[0.05] dark:hover:bg-white/[0.05] rounded-lg transition-all duration-300 group/author cursor-pointer"
                        >
                          <svg className="size-3.5 text-black/40 dark:text-white/40 group-hover/author:text-black/60 dark:group-hover/author:text-white/60 transition-colors" fill="none" stroke="currentColor" strokeWidth="1.2" viewBox="0 0 24 24">
                            <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                            <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                          </svg>
                          <span className="text-[13px] font-mono tracking-tight text-black/70 dark:text-white/70 group-hover/author:text-black dark:group-hover/author:text-white transition-colors duration-200">
                            @{reel.author_username}
                          </span>
                          <span className="text-[9px] text-black/30 dark:text-white/30 group-hover/author:text-black/60 dark:group-hover/author:text-white/60 transition-all duration-300 transform translate-y-0.5 group-hover/author:-translate-y-0.5 group-hover/author:translate-x-0.5 font-mono">
                            ↗
                          </span>
                        </a>
                      ) : (
                        <span className="text-[13px] font-mono text-black/40 dark:text-white/40">
                          Unknown Author
                        </span>
                      )}
                    </div>
                  </div>
                  {reel.duration_seconds && (
                    <div className="text-right">
                      <h4 className="text-[9px] font-medium uppercase tracking-[0.2em] text-black/40 dark:text-white/40 mb-2">Duration</h4>
                      <p className="text-[15px] font-mono text-black dark:text-white">{reel.duration_seconds}s</p>
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="text-[9px] font-medium uppercase tracking-[0.2em] text-black/40 dark:text-white/40 mb-2">Status</h4>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${reel.analysis_status === "completed" ? "bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.6)]" : "bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.6)]"}`} />
                    <span className="text-[11px] font-mono uppercase tracking-wider text-black/70 dark:text-white/70">{reel.analysis_status}</span>
                  </div>
                  {reel.error_message && (
                    <p className="text-[11px] text-rose-500 mt-3 bg-rose-500/10 p-3 rounded-xl border border-rose-500/20">
                      {reel.error_message}
                    </p>
                  )}
                </div>

                <div className="pt-2">
                  <a
                    href={reel.instagram_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 bg-[#111111] hover:bg-black dark:bg-[#F2F2F0] dark:hover:bg-white text-[#FAFAF8] dark:text-[#111111] py-3.5 rounded-full text-[11px] uppercase tracking-widest font-medium transition-all duration-300 shadow-[0_4px_14px_rgba(0,0,0,0.1)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.15)] active:scale-[0.98]"
                  >
                    View Original
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </a>
                </div>

                {/* Tags */}
                {tags.length > 0 && (
                  <div className="pt-4 border-t border-black/5 dark:border-white/5 flex flex-wrap gap-2 transition-colors duration-500">
                    {tags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] font-mono uppercase tracking-widest text-black/50 dark:text-white/50 bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 px-3 py-1.5 rounded-full"
                      >
                        #{tag.toLowerCase()}
                      </span>
                    ))}
                  </div>
                )}

                {/* Dot Matrix Graphic Equalizer - Inside the card at the end */}
                {/* <div className="pt-6 border-t border-black/5 dark:border-white/5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[9px] font-mono tracking-[0.25em] uppercase text-black/40 dark:text-white/40 font-bold">
                        NEURAL.MATRIX.STREAM
                      </span>
                    </div>
                    <span className="text-[8px] font-mono uppercase tracking-widest px-2 py-0.5 rounded bg-black/5 dark:bg-white/5 text-black/50 dark:text-white/40">
                      ACTV // 24_NODE
                    </span>
                  </div>

                  <div className="flex items-center justify-center gap-[5px] py-4 bg-black/[0.02] dark:bg-white/[0.02] rounded-2xl border border-black/5 dark:border-white/5 shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)] dark:shadow-[inset_0_1px_2px_rgba(0,0,0,0.3)]">
                    {matrixValues.map((val, colIdx) => (
                      <div key={colIdx} className="flex flex-col gap-[5px] justify-center">
                        {Array.from({ length: 6 }).map((_, rowIndex) => {
                          const dotIdx = 5 - rowIndex;
                          const isActive = dotIdx < val;
                          return (
                            <div
                              key={rowIndex}
                              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                                isActive
                                  ? "bg-black/90 dark:bg-white/95 scale-[1.05] shadow-[0_0_6px_rgba(0,0,0,0.15)] dark:shadow-[0_0_10px_rgba(255,255,255,0.3)]"
                                  : "bg-black/10 dark:bg-white/10"
                              }`}
                            />
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div> */}
              </div>
            </div>
          </div>
        </section>

        {/* RIGHT COLUMN (Content Narrative) */}
        <section className="lg:col-span-7 space-y-16 pt-4 lg:pt-0">

          {/* Title Area */}
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-black/5 dark:bg-white/10 border border-black/5 dark:border-white/10 text-[10px] uppercase tracking-[0.2em] font-medium text-black/60 dark:text-white/60">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse" />
              Analysis Complete
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-[3.5rem] font-normal tracking-[-0.03em] text-[#111111] dark:text-[#F2F2F0] leading-[1.1]">
              {metadata.title || "Untitled AI Import"}
            </h1>
            <p className="text-[11px] font-mono uppercase tracking-widest text-black/40 dark:text-white/40">
              Analyzed on {reel.analyzed_at ? new Date(reel.analyzed_at).toLocaleString() : "Pending"}
            </p>
          </div>

          {editMode ? (
            /* EDIT MODE PANEL */
            <div className="p-1.5 rounded-[2rem] bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 backdrop-blur-xl">
              <div className="bg-[#FAFAF8] dark:bg-[#080808] rounded-[1.6rem] p-8 border border-white dark:border-white/5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.6)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] space-y-8">
                <h3 className="text-[10px] font-medium uppercase tracking-[0.2em] text-black/40 dark:text-white/40 flex items-center gap-2">
                  <span className="w-4 h-px bg-black/20 dark:bg-white/20" /> Edit Curation Details
                </h3>

                <div className="space-y-3">
                  <label className="text-[10px] font-medium uppercase tracking-[0.2em] text-black/50 dark:text-white/50">
                    Curation Tags (comma separated)
                  </label>
                  <input
                    type="text"
                    disabled={saveStatus !== "idle"}
                    className="w-full bg-white dark:bg-[#111111] border border-black/10 dark:border-white/10 px-4 py-3.5 text-[13px] outline-none rounded-xl text-black dark:text-white shadow-inner focus:border-emerald-500/50 transition-colors disabled:opacity-50"
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    placeholder="e.g. tutorial, tools, react, mcp"
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-medium uppercase tracking-[0.2em] text-black/50 dark:text-white/50">
                    Key Takeaways (one per line)
                  </label>
                  <textarea
                    rows={6}
                    disabled={saveStatus !== "idle"}
                    className="w-full bg-white dark:bg-[#111111] border border-black/10 dark:border-white/10 px-4 py-3.5 text-[13px] outline-none rounded-xl text-black dark:text-white shadow-inner leading-relaxed focus:border-emerald-500/50 transition-colors disabled:opacity-50"
                    value={takeawaysInput}
                    onChange={(e) => setTakeawaysInput(e.target.value)}
                    placeholder="Enter key insights here, one per line..."
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-medium uppercase tracking-[0.2em] text-black/50 dark:text-white/50">
                    Personal Notes & Custom Context
                  </label>
                  <textarea
                    rows={5}
                    disabled={saveStatus !== "idle"}
                    className="w-full bg-white dark:bg-[#111111] border border-black/10 dark:border-white/10 px-4 py-3.5 text-[13px] outline-none rounded-xl text-black dark:text-white shadow-inner leading-relaxed focus:border-emerald-500/50 transition-colors disabled:opacity-50"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Write your personal annotations, research thoughts, or lists here..."
                  />
                </div>

                <div className="flex justify-end gap-3 pt-6 border-t border-black/5 dark:border-white/5">
                  <button
                    type="button"
                    disabled={saveStatus !== "idle"}
                    onClick={() => setEditMode(false)}
                    className="border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 px-6 py-2.5 rounded-full text-[11px] uppercase tracking-wider font-medium transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <PrimeButton
                    actionState={saveStatus}
                    onClick={handleSaveMetadata}
                    className="bg-[#111111] dark:bg-white hover:bg-black dark:hover:bg-gray-200 text-[#FAFAF8] dark:text-[#111111] px-6 py-2.5 rounded-full text-[11px] uppercase tracking-wider font-medium shadow-lg min-w-[140px]"
                  >
                    Save Changes
                  </PrimeButton>
                </div>
              </div>
            </div>
          ) : (
            /* STATIC MODE */
            <>
              {/* Executive Summary */}
              <div className="p-1.5 rounded-[2rem] bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 backdrop-blur-xl">
                <div className="bg-[#FAFAF8] dark:bg-[#080808] rounded-[1.6rem] p-8 sm:p-10 border border-white dark:border-white/5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.6)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]">
                  <h3 className="text-[10px] font-medium uppercase tracking-[0.2em] text-black/40 dark:text-white/40 flex items-center gap-2 mb-6">
                    <span className="w-4 h-px bg-black/20 dark:bg-white/20" /> Executive Summary
                  </h3>
                  <p className="text-[15px] leading-[1.8] text-black/80 dark:text-[#F2F2F0]/80">
                    {metadata.summary || "Summary details are currently unavailable."}
                  </p>
                </div>
              </div>

              {/* Key Takeaways */}
              <div className="pl-4 sm:pl-8 border-l border-black/10 dark:border-white/10 py-2">
                <h3 className="text-[10px] font-medium uppercase tracking-[0.2em] text-black/40 dark:text-white/40 mb-6">
                  Key Takeaways
                </h3>
                {keyTakeaways.length > 0 ? (
                  <ul className="space-y-5">
                    {keyTakeaways.map((takeaway, idx) => (
                      <li key={idx} className="flex gap-4 text-[14px] text-black/80 dark:text-[#F2F2F0]/80 leading-[1.7] items-start">
                        <span className="text-black/30 dark:text-white/30 font-mono text-[10px] pt-1">0{idx + 1}</span>
                        <span>{takeaway}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[13px] text-black/40 dark:text-white/40">No takeaways generated.</p>
                )}
              </div>

              {/* Personal Notes */}
              <div className="p-1.5 rounded-[2rem] bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 backdrop-blur-xl">
                <div className="bg-[#FAFAF8] dark:bg-[#080808] rounded-[1.6rem] p-8 sm:p-10 border border-white dark:border-white/5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.6)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]">
                  <h3 className="text-[10px] font-medium uppercase tracking-[0.2em] text-black/40 dark:text-white/40 flex items-center gap-2 mb-6">
                    <span className="w-4 h-px bg-black/20 dark:bg-white/20" /> Personal Curation Notes
                  </h3>
                  {metadata.notes ? (
                    <p className="text-[14px] leading-[1.8] text-black/80 dark:text-[#F2F2F0]/80 whitespace-pre-wrap">
                      {metadata.notes}
                    </p>
                  ) : (
                    <p className="text-[13px] text-black/40 dark:text-white/40 italic">
                      No personal notes added yet. Click "Edit Curation" in the top bar to add your annotations.
                    </p>
                  )}
                </div>
              </div>

              {/* Mentioned tools and clickable links */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

                {/* Mentioned Tools */}
                <div className="p-1.5 rounded-[2rem] bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 backdrop-blur-xl">
                  <div className="bg-[#FAFAF8] dark:bg-[#080808] rounded-[1.6rem] p-6 border border-white dark:border-white/5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.6)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] h-full">
                    <h3 className="text-[10px] font-medium uppercase tracking-[0.2em] text-black/40 dark:text-white/40 mb-5">Mentioned Tools</h3>
                    {tools.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {tools.map((tool, idx) => (
                          <span key={idx} className="text-[11px] font-mono uppercase tracking-wider text-black/70 dark:text-white/70 bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 px-3 py-1.5 rounded-full">
                            {tool}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[13px] text-black/40 dark:text-white/40">No tool brands detected.</p>
                    )}
                  </div>
                </div>

                {/* Extracted Resources */}
                <div className="p-1.5 rounded-[2rem] bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 backdrop-blur-xl">
                  <div className="bg-[#FAFAF8] dark:bg-[#080808] rounded-[1.6rem] p-6 border border-white dark:border-white/5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.6)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] h-full">
                    <h3 className="text-[10px] font-medium uppercase tracking-[0.2em] text-black/40 dark:text-white/40 mb-5 flex items-center justify-between">
                      <span>Extracted Resources</span>
                      <span className="text-[9px] text-black/30 dark:text-white/30 tracking-widest">LAYER</span>
                    </h3>
                    {(reel.resources && reel.resources.length > 0) ? (
                      <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar" data-lenis-prevent>
                        {reel.resources.map((res, idx) => {
                          const isVerified = res.verification_status === "verified";
                          const isFailed = res.verification_status === "failed_verification";
                          const isHallucinated = res.hallucination_flag;

                          let confBg = "bg-black/5 dark:bg-white/5 text-black/60 dark:text-white/60";
                          if (isHallucinated) {
                            confBg = "bg-rose-500/10 text-rose-500 dark:text-rose-400 border border-rose-500/20 animate-pulse";
                          } else if (res.confidence >= 80) {
                            confBg = "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20";
                          } else if (res.confidence >= 60) {
                            confBg = "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20";
                          } else {
                            confBg = "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20";
                          }

                          return (
                            <div
                              key={res.id || idx}
                              className={`p-4 rounded-2xl transition-all duration-300 ${isHallucinated
                                ? "bg-rose-500/[0.02] border border-rose-500/20"
                                : "bg-white dark:bg-[#111111] border border-black/5 dark:border-white/5 shadow-sm hover:shadow-md"
                                }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="space-y-1.5 min-w-0 flex-1">
                                  <div className="flex items-center flex-wrap gap-2">
                                    <span className="text-[13px] font-medium text-black dark:text-white truncate">
                                      {res.resource_name}
                                    </span>
                                    <span className="text-[8px] font-mono uppercase tracking-widest text-black/40 dark:text-white/40 bg-black/5 dark:bg-white/5 px-2 py-0.5 rounded-full">
                                      {res.resource_type}
                                    </span>
                                  </div>

                                  {res.resource_url ? (
                                    <a
                                      href={res.resource_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 transition-colors inline-flex items-center gap-1.5 mt-1 truncate max-w-full"
                                    >
                                      <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                      </svg>
                                      {res.resource_url.replace(/^https?:\/\/(www\.)?/, "")}
                                    </a>
                                  ) : (
                                    <span className="text-[11px] text-black/40 dark:text-white/40 italic block mt-1">No URL provided</span>
                                  )}
                                </div>

                                <div className="flex flex-col items-end gap-1.5 shrink-0">
                                  <span className={`text-[9px] font-mono uppercase tracking-widest px-2 py-1 rounded-full ${confBg}`}>
                                    {isHallucinated ? "HALLUCINATED" : `${Math.round(res.confidence)}%`}
                                  </span>

                                  <div className="flex items-center gap-1.5">
                                    {isVerified && (
                                      <span className="text-[9px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-mono uppercase tracking-widest">
                                        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                                        </svg>
                                        VERIFIED
                                      </span>
                                    )}
                                    {isFailed && (
                                      <span className="text-[9px] text-rose-500 flex items-center gap-1 font-mono uppercase tracking-widest">
                                        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                        </svg>
                                        OFFLINE
                                      </span>
                                    )}
                                    {res.verification_status === "pending_verification" && (
                                      <span className="text-[9px] text-black/40 dark:text-white/40 flex items-center gap-1.5 font-mono uppercase tracking-widest">
                                        <span className="w-1.5 h-1.5 bg-black/30 dark:bg-white/30 rounded-full animate-pulse" />
                                        CHECKING
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {res.description && (
                                <p className="text-[12px] text-black/60 dark:text-white/60 mt-4 border-t border-black/5 dark:border-white/5 pt-3 leading-relaxed">
                                  {res.description}
                                </p>
                              )}

                              {res.evidence_text && !res.evidence_text.startsWith("Pattern match for") && (
                                <div className="mt-4 bg-black/5 dark:bg-[#151515] p-3 rounded-xl border border-black/5 dark:border-white/5">
                                  <span className="text-[8px] font-medium uppercase tracking-[0.2em] text-black/40 dark:text-white/40 block">Evidence Context</span>
                                  <p className="text-[11px] text-black/60 dark:text-white/60 italic mt-1.5 leading-relaxed">
                                    "{res.evidence_text}"
                                  </p>

                                  {(res.timestamp_start || res.timestamp_end) && (
                                    <div className="flex items-center gap-2 mt-3">
                                      <button
                                        onClick={() => {
                                          setTranscriptOpen(true);
                                          setTimeout(() => {
                                            const transcriptSection = document.getElementById("transcript-section");
                                            if (transcriptSection) {
                                              transcriptSection.scrollIntoView({ behavior: "smooth" });
                                            }
                                          }, 100);
                                        }}
                                        className="inline-flex items-center gap-1.5 text-[9px] uppercase tracking-wider font-medium bg-white dark:bg-[#222222] border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/10 text-black/70 dark:text-white/70 px-3 py-1.5 rounded-full transition-colors"
                                      >
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        {res.timestamp_start ? `Jump to ${res.timestamp_start.split(".")[0]}` : "Show in Transcript"}
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : urls.length > 0 ? (
                      <ul className="space-y-3">
                        {urls.map((url, idx) => (
                          <li key={idx} className="truncate">
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[12px] font-mono text-black/80 dark:text-emerald-400 hover:text-emerald-500 transition-colors inline-flex items-center gap-2"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                              {url.replace(/^https?:\/\/(www\.)?/, "")}
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[13px] text-black/40 dark:text-white/40">No external resource links found.</p>
                    )}
                  </div>
                </div>

              </div>

              {/* Practical How-To Guide */}
              {metadata.how_to_guide && (
                <div className="p-1.5 rounded-[2rem] bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 backdrop-blur-xl">
                  <div className="bg-[#FAFAF8] dark:bg-[#080808] rounded-[1.6rem] border border-white dark:border-white/5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.6)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] p-8 sm:p-10 transition-colors duration-500">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] uppercase tracking-[0.2em] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 mb-6">
                      📋 Step-by-Step Guide
                    </span>

                    <h3 className="text-xl sm:text-2xl font-heading font-normal italic text-[#111111] dark:text-[#F2F2F0] leading-tight mb-6">
                      {metadata.how_to_guide.how_to_title || "How-To Stepwise Guide"}
                    </h3>

                    {metadata.how_to_guide.materials_needed && metadata.how_to_guide.materials_needed.length > 0 && (
                      <div className="flex flex-wrap gap-2 items-center text-xs pb-6 border-b border-black/5 dark:border-white/5 mb-8">
                        <span className="text-[10px] uppercase tracking-wider font-mono text-black/40 dark:text-white/40 mr-1">Prerequisites:</span>
                        {metadata.how_to_guide.materials_needed.map((item, idx) => (
                          <span key={idx} className="px-2.5 py-1 rounded-full text-[11px] font-mono bg-black/[0.03] dark:bg-white/[0.04] text-black/60 dark:text-white/60 border border-black/5 dark:border-white/5">
                            {item}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="space-y-6">
                      {metadata.how_to_guide.steps && metadata.how_to_guide.steps.map((step, i) => {
                        const parts = step.split(":");
                        const hasPrefix = parts.length > 1 && parts[0].toLowerCase().startsWith("step");
                        const stepTitle = hasPrefix ? parts[0] : `Step ${i + 1}`;
                        const stepText = hasPrefix ? parts.slice(1).join(":") : step;

                        return (
                          <div key={i} className="flex gap-5 items-start group">
                            <div className="flex-shrink-0 size-8 rounded-full bg-[#FAFAF8] dark:bg-[#080808] border border-black/10 dark:border-white/10 text-black/40 dark:text-white/40 font-mono text-xs flex items-center justify-center shadow-sm transition-all duration-550 group-hover:border-emerald-500/30 group-hover:text-emerald-500 group-hover:shadow-[0_0_20px_rgba(16,185,129,0.1)]">
                              {String(i + 1).padStart(2, '0')}
                            </div>
                            <div className="space-y-1.5 pt-1.5 flex-1">
                              {hasPrefix ? (
                                <>
                                  <h5 className="text-[10px] font-mono uppercase tracking-wider text-black/40 dark:text-white/40">
                                    {stepTitle}
                                  </h5>
                                  <p className="text-[14px] text-black/75 dark:text-white/80 leading-[1.7] font-sans">
                                    {stepText}
                                  </p>
                                </>
                              ) : (
                                <p className="text-[14px] text-black/75 dark:text-white/80 leading-[1.7] font-sans">
                                  {step}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {metadata.how_to_guide.estimated_time && (
                      <div className="flex items-center gap-2 mt-10 pt-6 border-t border-black/5 dark:border-white/5 text-[11px] font-mono uppercase tracking-wider text-emerald-600 dark:text-emerald-450">
                        <svg className="size-4 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Estimated Effort: {metadata.how_to_guide.estimated_time}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Collapsible Visual Description */}
              {metadata.visual_description && (
                <div className="p-1.5 rounded-[2rem] bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 backdrop-blur-xl">
                  <div className="bg-[#FAFAF8] dark:bg-[#080808] rounded-[1.6rem] border border-white dark:border-white/5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.6)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] overflow-hidden transition-all duration-500">
                    <button
                      onClick={() => setVisualOpen(!visualOpen)}
                      className="w-full flex items-center justify-between hover:bg-black/5 dark:hover:bg-white/5 px-8 py-6 text-left transition-colors"
                    >
                      <h3 className="text-[10px] font-medium uppercase tracking-[0.2em] text-black/60 dark:text-white/60 flex items-center gap-2">
                        <span className="w-4 h-px bg-black/20 dark:bg-white/20" /> Visual Cues & Scene Details
                      </h3>
                      <span className="text-[10px] uppercase tracking-widest text-black/40 dark:text-white/40 font-mono">
                        {visualOpen ? "HIDE [-]" : "SHOW [+]"}
                      </span>
                    </button>

                    {visualOpen && (
                      <div className="px-8 pb-8 pt-2 space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
                        <p className="text-[14px] leading-[1.8] text-black/70 dark:text-white/70 whitespace-pre-line font-mono bg-black/5 dark:bg-white/5 p-6 rounded-2xl border border-black/5 dark:border-white/10 transition-colors duration-500">
                          {metadata.visual_description}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Collapsible Transcript */}
              <div id="transcript-section" className="p-1.5 rounded-[2rem] bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 backdrop-blur-xl">
                <div className="bg-[#FAFAF8] dark:bg-[#080808] rounded-[1.6rem] border border-white dark:border-white/5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.6)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] overflow-hidden transition-all duration-500">
                  <button
                    onClick={() => setTranscriptOpen(!transcriptOpen)}
                    className="w-full flex items-center justify-between hover:bg-black/5 dark:hover:bg-white/5 px-8 py-6 text-left transition-colors"
                  >
                    <h3 className="text-[10px] font-medium uppercase tracking-[0.2em] text-black/60 dark:text-white/60 flex items-center gap-2">
                      <span className="w-4 h-px bg-black/20 dark:bg-white/20" /> Full Audio Transcript
                    </h3>
                    <span className="text-[10px] uppercase tracking-widest text-black/40 dark:text-white/40 font-mono">
                      {transcriptOpen ? "HIDE [-]" : "SHOW [+]"}
                    </span>
                  </button>

                  {transcriptOpen && (
                    <div className="px-8 pb-8 pt-2 space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
                      <div className="flex items-center gap-4 text-[9px] uppercase tracking-widest text-black/40 dark:text-white/40 border-t border-black/5 dark:border-white/5 pt-6">
                        <span>Language: {metadata.language_detected || "hinglish"}</span>
                        <span className="w-1 h-1 rounded-full bg-black/20 dark:bg-white/20" />
                        <span>Status: {transcript.transcription_status || "completed"}</span>
                      </div>

                      <p className="text-[14px] leading-[2] text-black/80 dark:text-[#F2F2F0] whitespace-pre-wrap font-sans">
                        {transcript.plain_text || "No speech detected in the audio track of this import."}
                      </p>
                    </div>
                  )}
                </div>
              </div>


            </>
          )}

        </section>

      </div>

      {/* Brand Watermark / Fluid Gradient Text at the Bottom */}
      <div className="absolute bottom-0 left-0 w-full text-black/90 dark:text-white/90 no-print z-0">
        <div className="pointer-events-none absolute inset-x-0 top-0 text-center text-[9px] uppercase tracking-[0.25em] text-black/30 dark:text-white/30 select-none">
          <span className="hidden pointer-fine:inline-block">
            Move your cursor within the text below
          </span>
          <span className="hidden pointer-coarse:inline-block">
            Press anywhere within the text below
          </span>
        </div>
        <div className="h-44 md:h-64 w-full flex items-center justify-center">
          <FluidGradientText text="SuperBrain" svgViewBoxWidth={1800} svgViewBoxHeight={300} />
        </div>
      </div>

      <MindMapModal
        isOpen={showMindMap}
        onClose={() => setShowMindMap(false)}
        reelId={id}
        reelData={reel}
        onMindMapGenerated={(generatedData) => {
          setReel((prev) => ({
            ...prev,
            reel_metadata: {
              ...prev.reel_metadata,
              mind_map: generatedData
            }
          }));
        }}
      />
    </div>
  );
}
