import React, { useState, useEffect, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { supabase } from "../utils/supabaseClient";
import ThemeToggle from "../components/ThemeToggle";
import MindMapModal from "../components/MindMapModal";
import { Button } from "../components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../components/ui/tooltip";
import { Edit3, Brain, Download, Trash2, FileText, Printer, X } from "lucide-react";

export default function ReelDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [reel, setReel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [showMindMap, setShowMindMap] = useState(false);

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
  const [savingMetadata, setSavingMetadata] = useState(false);

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
    setSavingMetadata(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;

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
      setEditMode(false);
    } catch (err) {
      console.error("Error updating metadata:", err);
      alert("Failed to save curation updates.");
    } finally {
      setSavingMetadata(false);
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
      <div className="min-h-screen bg-neutral-50 dark:bg-[#0a0a0a] text-neutral-900 dark:text-neutral-100 font-sans transition-colors duration-200">
        {/* Skeleton Header */}
        <header className="sticky top-0 z-50 bg-white/95 dark:bg-[#0a0a0a]/90 backdrop-blur-md border-b border-neutral-200 dark:border-[#181818] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-xs font-mono text-neutral-400 dark:text-neutral-500 flex items-center gap-1">
              &lt; Back
            </span>
            <div className="h-4 w-px bg-neutral-200 dark:bg-neutral-800" />
            <div className="h-3 w-32 bg-neutral-250 dark:bg-neutral-800 rounded animate-pulse" />
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <div className="h-9 w-9 bg-neutral-200 dark:bg-neutral-800 rounded-lg animate-pulse" />
            <div className="h-9 w-9 bg-neutral-200 dark:bg-neutral-800 rounded-lg animate-pulse" />
            <div className="h-9 w-9 bg-neutral-200 dark:bg-neutral-800 rounded-lg animate-pulse" />
            <div className="h-9 w-9 bg-neutral-200 dark:bg-neutral-800 rounded-lg animate-pulse" />
          </div>
        </header>

        {/* Skeleton Main Grid */}
        <div className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* LEFT COLUMN: Media Info Panel */}
          <section className="lg:col-span-5 bg-white dark:bg-[#0d0d0d] border border-neutral-200 dark:border-[#181818] rounded-[3px] p-6 space-y-6">
            <div className="aspect-video w-full bg-neutral-100 dark:bg-[#141414] rounded animate-pulse border border-neutral-200 dark:border-neutral-850" />
            
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="h-4 w-1/3 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
                <div className="h-6 w-3/4 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
              </div>
              
              <div className="flex gap-2">
                <div className="h-5 w-16 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
                <div className="h-5 w-20 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
                <div className="h-5 w-14 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
              </div>

              <hr className="border-neutral-200 dark:border-[#1c1c1c]" />

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-neutral-100 dark:bg-[#141414] rounded-full animate-pulse" />
                <div className="space-y-1.5 flex-1">
                  <div className="h-3 w-1/3 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
                  <div className="h-3.5 w-1/2 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
                </div>
              </div>
            </div>
          </section>

          {/* RIGHT COLUMN: Intelligence Panels */}
          <section className="lg:col-span-7 bg-white dark:bg-[#0d0d0d] border border-neutral-200 dark:border-[#181818] rounded-[3px] p-6 space-y-8">
            {/* Summary */}
            <div className="space-y-3">
              <div className="h-4.5 w-24 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
              <div className="space-y-2">
                <div className="h-3.5 w-full bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
                <div className="h-3.5 w-full bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
                <div className="h-3.5 w-5/6 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
              </div>
            </div>

            {/* Takeaways */}
            <div className="space-y-3">
              <div className="h-4.5 w-32 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
              <div className="space-y-2.5">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex gap-2">
                    <div className="h-4 w-4 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
                    <div className="h-4 w-5/6 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
                  </div>
                ))}
              </div>
            </div>

            {/* Tools & Resources */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-neutral-200 dark:border-[#1c1c1c]">
              <div className="space-y-3">
                <div className="h-4 w-28 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
                <div className="flex flex-wrap gap-2">
                  <div className="h-6 w-16 bg-neutral-200 dark:bg-neutral-800 rounded-full animate-pulse" />
                  <div className="h-6 w-24 bg-neutral-200 dark:bg-neutral-800 rounded-full animate-pulse" />
                  <div className="h-6 w-20 bg-neutral-200 dark:bg-neutral-800 rounded-full animate-pulse" />
                </div>
              </div>
              <div className="space-y-3">
                <div className="h-4 w-28 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
                <div className="space-y-2">
                  <div className="h-3.5 w-2/3 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
                  <div className="h-3.5 w-1/2 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
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
    <div className="min-h-screen bg-neutral-50 dark:bg-[#0a0a0a] text-neutral-900 dark:text-neutral-100 font-sans selection:bg-emerald-500 dark:selection:bg-emerald-400 selection:text-white dark:selection:text-black transition-colors duration-200">
      
      {/* Detail Header / Nav bar */}
      <header className="sticky top-0 z-50 bg-white/95 dark:bg-[#0a0a0a]/90 backdrop-blur-md border-b border-neutral-200 dark:border-[#181818] px-6 py-4 flex items-center justify-between transition-colors duration-200">
        <div className="flex items-center gap-4">
          <Link
            to="/dashboard"
            className="group flex items-center gap-1 text-xs font-mono text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-200 transition-colors"
          >
            <span className="group-hover:-translate-x-0.5 transition-transform">&lt;</span> Back
          </Link>
          <div className="h-4 w-px bg-neutral-200 dark:bg-neutral-800" />
          <span className="text-xs font-mono text-neutral-400 dark:text-neutral-500 truncate max-w-[200px] md:max-w-md">
            Import ID: {reel.id}
          </span>
        </div>
        
        <div className="flex items-center gap-3 no-print">
          <ThemeToggle />
          
          {/* Edit Curation Button */}
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={editMode ? "secondary" : "outline"}
                  size="icon"
                  onClick={() => setEditMode(!editMode)}
                  className={editMode ? "border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 dark:hover:bg-emerald-500/30" : "hover:text-emerald-500 hover:border-emerald-500/30 hover:bg-emerald-500/5 dark:hover:text-emerald-400 dark:hover:border-emerald-500/30 dark:hover:bg-emerald-500/10"}
                >
                  {editMode ? <X size={16} strokeWidth={2} /> : <Edit3 size={16} strokeWidth={2} />}
                </Button>
              </TooltipTrigger>
              <TooltipContent className="px-2 py-1 text-xs">
                {editMode ? "Cancel Editing" : "Edit Curation"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Mind Map Button */}
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setShowMindMap(true)}
                  className="hover:text-blue-500 hover:border-blue-500/30 hover:bg-blue-500/5 dark:hover:text-blue-400 dark:hover:border-blue-500/30 dark:hover:bg-blue-500/10 transition-all duration-300 relative group"
                >
                  <span className="absolute -inset-0.5 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-500 opacity-0 group-hover:opacity-10 blur-sm transition-opacity duration-300" />
                  <Brain size={16} strokeWidth={2} className="relative z-10" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="px-2 py-1 text-xs">Visual Mind Map</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Export Dropdown Group */}
          <div className="relative" ref={exportDropdownRef}>
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setShowExportDropdown(!showExportDropdown)}
                    className={showExportDropdown ? "bg-amber-500/10 border-amber-500/30 text-amber-500 dark:text-amber-400" : "hover:text-amber-500 hover:border-amber-500/30 hover:bg-amber-500/5 dark:hover:text-amber-400 dark:hover:border-amber-500/30 dark:hover:bg-amber-500/10"}
                  >
                    <Download size={16} strokeWidth={2} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="px-2 py-1 text-xs">Export Analysis</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            {showExportDropdown && (
              <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-[#0c0c0e] border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-lg py-1 z-50 animate-in fade-in slide-in-from-top-1 duration-100">
                <button
                  onClick={() => {
                    exportMarkdown();
                    setShowExportDropdown(false);
                  }}
                  className="w-full text-left px-4 py-2 text-xs flex items-center gap-2.5 text-neutral-700 dark:text-neutral-350 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors"
                >
                  <FileText size={14} className="text-neutral-500" />
                  <span>Export Markdown (.md)</span>
                </button>
                <button
                  onClick={() => {
                    window.print();
                    setShowExportDropdown(false);
                  }}
                  className="w-full text-left px-4 py-2 text-xs flex items-center gap-2.5 text-neutral-700 dark:text-neutral-350 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors"
                >
                  <Printer size={14} className="text-neutral-500" />
                  <span>Print / Save PDF</span>
                </button>
              </div>
            )}
          </div>

          {/* Delete Save Button */}
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  disabled={deleting}
                  onClick={handleDelete}
                  className="hover:text-rose-500 hover:border-rose-500/30 hover:bg-rose-500/5 dark:hover:text-rose-450 dark:hover:border-rose-500/30 dark:hover:bg-rose-500/10 transition-all disabled:opacity-50"
                >
                  <Trash2 size={16} strokeWidth={2} />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="px-2 py-1 text-xs">
                {deleting ? "Deleting Curation..." : "Delete Curation"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </header>

      {/* Main Grid: Asymmetric 40 / 60 Split */}
      <div className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT COLUMN (40% width): Media Info Panel */}
        <section className="lg:col-span-5 bg-white dark:bg-[#0d0d0d] border border-neutral-200 dark:border-[#181818] rounded-[3px] overflow-hidden p-6 lg:sticky lg:top-24 transition-colors duration-200">
          <div className="relative aspect-video w-full bg-neutral-100 dark:bg-[#141414] overflow-hidden border border-neutral-200 dark:border-[#222] rounded-[2px] mb-6">
            {reel.thumbnail_url ? (
              <img
                src={reel.thumbnail_url}
                alt={metadata.title || "Visual preview"}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-neutral-405 dark:text-neutral-600 text-xs font-mono">
                NO PREVIEW AVAILABLE
              </div>
            )}
            
            {metadata.content_type && (
              <span className="absolute top-3 right-3 px-2 py-0.5 text-[9px] font-mono tracking-wider uppercase bg-white/90 dark:bg-black/80 text-neutral-800 dark:text-neutral-300 border border-neutral-300 dark:border-neutral-800 rounded-[2px]">
                {metadata.content_type}
              </span>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <h4 className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Source Profile</h4>
              <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 mt-1">
                {reel.author_username ? `@${reel.author_username}` : "Unknown Author"}
              </p>
            </div>

            {reel.duration_seconds && (
              <div>
                <h4 className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Duration</h4>
                <p className="text-xs font-mono text-neutral-700 dark:text-neutral-300 mt-1">{reel.duration_seconds} seconds</p>
              </div>
            )}

            <div>
              <h4 className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Analysis Status</h4>
              <div className="flex items-center gap-1.5 mt-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${reel.analysis_status === "completed" ? "bg-emerald-500" : "bg-rose-500"}`} />
                <span className="text-xs font-mono uppercase text-neutral-700 dark:text-neutral-300">{reel.analysis_status}</span>
              </div>
              {reel.error_message && (
                <p className="text-[11px] font-mono text-rose-600 dark:text-rose-400 mt-2 bg-rose-500/5 p-2 border border-rose-500/10 rounded-[2px]">
                  {reel.error_message}
                </p>
              )}
            </div>

            <div className="pt-4 border-t border-neutral-200 dark:border-[#181818]">
              <a
                href={reel.instagram_url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 bg-neutral-900 hover:bg-neutral-800 dark:bg-[#161616] dark:hover:bg-[#202020] border border-neutral-800 dark:border-[#262626] text-xs font-mono text-white dark:text-neutral-200 py-2.5 rounded-[3px] transition-colors"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.051.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                </svg>
                View on Instagram
              </a>
            </div>
          </div>
        </section>

        {/* RIGHT COLUMN (60% width): Content Narrative */}
        <section className="lg:col-span-7 space-y-8">
          
          {/* Title Area */}
          <div>
            <h1 className="text-3xl md:text-4xl font-heading font-normal italic tracking-tight text-neutral-900 dark:text-neutral-100 leading-tight">
              {metadata.title || "Untitled AI Import"}
            </h1>
            <p className="text-xs font-mono text-neutral-400 dark:text-neutral-500 mt-2">
              Analyzed on: {reel.analyzed_at ? new Date(reel.analyzed_at).toLocaleString() : "Pending"}
            </p>
          </div>

          {editMode ? (
            /* EDIT MODE PANEL */
            <div className="bg-white dark:bg-[#0c0c0c] border border-neutral-200 dark:border-[#1a1a1a] p-6 rounded-[3px] space-y-6 transition-colors duration-200">
              <h3 className="text-xs font-mono uppercase tracking-wider text-neutral-850 dark:text-neutral-100 border-b border-neutral-200 dark:border-[#181818] pb-2 mb-4">
                Edit Curation Details
              </h3>
              
              <div className="space-y-2">
                <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-450 dark:text-neutral-500">
                  Curation Tags (comma separated)
                </label>
                <input
                  type="text"
                  className="w-full bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#888]/20 px-3 py-2.5 text-xs outline-none rounded-[3px] text-neutral-900 dark:text-emerald-500"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="e.g. tutorial, tools, react, mcp"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-450 dark:text-neutral-500">
                  Key Takeaways (one per line)
                </label>
                <textarea
                  rows={6}
                  className="w-full bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#888]/20 px-3 py-2.5 text-xs outline-none rounded-[3px] text-neutral-900 dark:text-neutral-200 font-mono leading-relaxed"
                  value={takeawaysInput}
                  onChange={(e) => setTakeawaysInput(e.target.value)}
                  placeholder="Enter key insights here, one per line..."
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-450 dark:text-neutral-500">
                  Personal Notes & Custom Context
                </label>
                <textarea
                  rows={5}
                  className="w-full bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#888]/20 px-3 py-2.5 text-xs outline-none rounded-[3px] text-neutral-900 dark:text-neutral-200 leading-relaxed"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Write your personal annotations, research thoughts, or lists here..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-neutral-150 dark:border-neutral-900 text-xs font-mono">
                <button
                  type="button"
                  onClick={() => setEditMode(false)}
                  className="border border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600 px-4 py-2 rounded-[3px]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={savingMetadata}
                  onClick={handleSaveMetadata}
                  className="bg-neutral-900 dark:bg-emerald-500 hover:bg-neutral-800 dark:hover:bg-emerald-400 text-white dark:text-black px-4 py-2 rounded-[3px]"
                >
                  {savingMetadata ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          ) : (
            /* STATIC MODE */
            <>
              {/* Curation summary */}
              <div className="bg-white dark:bg-[#0c0c0c] border border-neutral-200 dark:border-[#1a1a1a] p-6 rounded-[3px] transition-colors duration-200">
                <h3 className="text-xs font-mono uppercase tracking-wider text-neutral-450 dark:text-neutral-400 mb-2">Executive Summary</h3>
                <p className="text-sm leading-relaxed text-neutral-700 dark:text-neutral-350">
                  {metadata.summary || "Summary details are currently unavailable."}
                </p>
              </div>

              {/* Key Takeaways */}
              <div>
                <h3 className="text-xs font-mono uppercase tracking-wider text-neutral-450 dark:text-neutral-400 border-b border-neutral-200 dark:border-[#181818] pb-2 mb-4">
                  Key Takeaways
                </h3>
                {keyTakeaways.length > 0 ? (
                  <ul className="space-y-3">
                    {keyTakeaways.map((takeaway, idx) => (
                      <li key={idx} className="flex gap-3 text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed items-start">
                        <span className="text-neutral-900 dark:text-emerald-400 font-mono text-xs select-none">[{idx + 1}]</span>
                        <span>{takeaway}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs font-mono text-neutral-500">No takeaways generated.</p>
                )}
              </div>

              {/* Personal Notes */}
              <div className="bg-white dark:bg-[#0c0c0c] border border-neutral-200 dark:border-[#1a1a1a] p-6 rounded-[3px] transition-colors duration-200">
                <h3 className="text-xs font-mono uppercase tracking-wider text-neutral-450 dark:text-neutral-400 mb-2">Personal Curation Notes</h3>
                {metadata.notes ? (
                  <p className="text-sm leading-relaxed text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap font-mono">
                    {metadata.notes}
                  </p>
                ) : (
                  <p className="text-xs font-mono text-neutral-400 dark:text-neutral-600 italic">
                    No personal notes added yet. Click "Edit Curation" in the top bar to add your annotations.
                  </p>
                )}
              </div>

              {/* Mentioned tools and clickable links */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Mentioned Tools */}
                <div className="bg-white dark:bg-[#0b0b0b] border border-neutral-200 dark:border-[#161616] p-5 rounded-[3px] transition-colors duration-200">
                  <h3 className="text-xs font-mono uppercase tracking-wider text-neutral-450 dark:text-neutral-400 mb-3">Mentioned Tools</h3>
                  {tools.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {tools.map((tool, idx) => (
                        <span key={idx} className="text-xs font-mono text-neutral-900 dark:text-emerald-400 bg-neutral-100 dark:bg-emerald-500/5 border border-neutral-200 dark:border-emerald-500/10 px-2.5 py-1 rounded-[2px]">
                          {tool}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs font-mono text-neutral-400 dark:text-neutral-600">No tool brands detected.</p>
                  )}
                </div>

                {/* Extracted Resources */}
                <div className="bg-white dark:bg-[#0b0b0b] border border-neutral-200 dark:border-[#161616] p-5 rounded-[3px] transition-colors duration-200">
                  <h3 className="text-xs font-mono uppercase tracking-wider text-neutral-450 dark:text-neutral-400 mb-3 flex items-center justify-between">
                    <span>Extracted Resources</span>
                    <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-normal">Reliability Layer</span>
                  </h3>
                  {(reel.resources && reel.resources.length > 0) ? (
                    <div className="space-y-4 max-h-[450px] overflow-y-auto pr-1">
                      {reel.resources.map((res, idx) => {
                        const isVerified = res.verification_status === "verified";
                        const isFailed = res.verification_status === "failed_verification";
                        const isHallucinated = res.hallucination_flag;
                        
                        let confBg = "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400";
                        if (isHallucinated) {
                          confBg = "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 animate-pulse";
                        } else if (res.confidence >= 80) {
                          confBg = "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20";
                        } else if (res.confidence >= 60) {
                          confBg = "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20";
                        } else {
                          confBg = "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20";
                        }

                        return (
                          <div 
                            key={res.id || idx} 
                            className={`p-3 border rounded-[3px] transition-all duration-200 ${
                              isHallucinated 
                                ? "bg-red-500/[0.02] border-red-500/20" 
                                : "bg-neutral-50/50 dark:bg-[#0c0c0e] border-neutral-150 dark:border-[#1a1a1f] hover:border-neutral-300 dark:hover:border-neutral-800"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="space-y-1 min-w-0 flex-1">
                                <div className="flex items-center flex-wrap gap-2">
                                  <span className="text-xs font-semibold font-mono text-neutral-900 dark:text-neutral-100 truncate">
                                    {res.resource_name}
                                  </span>
                                  <span className="text-[8.5px] font-mono uppercase tracking-wider text-neutral-400 dark:text-neutral-500 bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded-[2px]">
                                    {res.resource_type}
                                  </span>
                                </div>

                                {res.resource_url ? (
                                  <a
                                    href={res.resource_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[11px] font-mono text-emerald-600 dark:text-emerald-450 hover:underline inline-flex items-center gap-1 mt-1 truncate max-w-full"
                                  >
                                    <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                    {res.resource_url.replace(/^https?:\/\/(www\.)?/, "")}
                                  </a>
                                ) : (
                                  <span className="text-[11px] text-neutral-400 dark:text-neutral-600 italic block mt-1">No URL provided</span>
                                )}
                              </div>

                              <div className="flex flex-col items-end gap-1 shrink-0">
                                <span className={`text-[8.5px] font-mono font-medium px-2 py-0.5 rounded-full ${confBg}`}>
                                  {isHallucinated ? "HALLUCINATED" : `${Math.round(res.confidence)}% Match`}
                                </span>
                                
                                <div className="flex items-center gap-1">
                                  {isVerified && (
                                    <span className="text-[9px] text-emerald-600 dark:text-emerald-450 flex items-center gap-0.5 font-mono">
                                      <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                                      </svg>
                                      verified
                                    </span>
                                  )}
                                  {isFailed && (
                                    <span className="text-[9px] text-red-500 dark:text-red-400 flex items-center gap-0.5 font-mono">
                                      <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                      </svg>
                                      offline
                                    </span>
                                  )}
                                  {res.verification_status === "pending_verification" && (
                                    <span className="text-[9px] text-neutral-400 dark:text-neutral-500 flex items-center gap-1 font-mono">
                                      <span className="w-1.5 h-1.5 bg-neutral-350 dark:bg-neutral-600 rounded-full animate-pulse" />
                                      checking
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {res.description && (
                              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-2 border-t border-neutral-100 dark:border-neutral-900 pt-1.5 leading-relaxed">
                                {res.description}
                              </p>
                            )}

                            {res.evidence_text && !res.evidence_text.startsWith("Pattern match for") && (
                              <div className="mt-2 bg-neutral-100/30 dark:bg-neutral-900/30 p-2 rounded-[2px] border border-neutral-200/20 dark:border-neutral-800/25">
                                <span className="text-[8px] font-mono text-neutral-400 dark:text-neutral-500 uppercase tracking-wider block">Evidence Context</span>
                                <p className="text-[10px] text-neutral-605 dark:text-neutral-400 italic mt-0.5 leading-relaxed">
                                  "{res.evidence_text}"
                                </p>
                                
                                {(res.timestamp_start || res.timestamp_end) && (
                                  <div className="flex items-center gap-1.5 mt-1.5">
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
                                      className="inline-flex items-center gap-1 text-[9px] font-mono bg-white dark:bg-[#151515] border border-neutral-250 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-605 dark:text-neutral-350 px-2 py-0.5 rounded-[2px] transition-colors"
                                    >
                                      <svg className="w-2 h-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                    <ul className="space-y-2">
                      {urls.map((url, idx) => (
                        <li key={idx} className="truncate">
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-mono text-neutral-900 dark:text-emerald-400 hover:underline inline-flex items-center gap-1.5"
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
                    <p className="text-xs font-mono text-neutral-400 dark:text-neutral-600">No external resource links found.</p>
                  )}
                </div>

              </div>

              {/* Visual Description */}
              {metadata.visual_description && (
                <div>
                  <h3 className="text-xs font-mono uppercase tracking-wider text-neutral-450 dark:text-neutral-400 border-b border-neutral-200 dark:border-[#181818] pb-2 mb-3">
                    Visual Cues & Scene Details
                  </h3>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed font-mono whitespace-pre-line bg-white dark:bg-[#080808] p-4 border border-neutral-200 dark:border-[#141414] rounded-[2px] transition-colors duration-200">
                    {metadata.visual_description}
                  </p>
                </div>
              )}

              {/* Collapsible Transcript */}
              <div id="transcript-section" className="border border-neutral-200 dark:border-[#181818] rounded-[3px] overflow-hidden transition-colors duration-200">
                <button
                  onClick={() => setTranscriptOpen(!transcriptOpen)}
                  className="w-full flex items-center justify-between bg-white dark:bg-[#0d0d0d] hover:bg-neutral-50 dark:hover:bg-[#121212] px-6 py-4 text-left transition-colors"
                >
                  <span className="text-xs font-mono uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                    Full Audio Transcript
                  </span>
                  <span className="text-xs font-mono text-neutral-450 dark:text-neutral-500">
                    {transcriptOpen ? "Hide [-]" : "Show [+]"}
                  </span>
                </button>
                
                {transcriptOpen && (
                  <div className="p-6 bg-neutral-50 dark:bg-[#0a0a0a] border-t border-neutral-200 dark:border-[#181818] space-y-4 transition-colors duration-200">
                    <div className="flex items-center gap-4 text-[10px] font-mono text-neutral-450 dark:text-neutral-500">
                      <span>Language: {metadata.language_detected || "hinglish"}</span>
                      <span>•</span>
                      <span>Transcription: {transcript.transcription_status || "completed"}</span>
                    </div>
                    
                    <p className="text-sm leading-relaxed text-neutral-750 dark:text-neutral-300 whitespace-pre-wrap font-sans">
                      {transcript.plain_text || "No speech detected in the audio track of this import."}
                    </p>
                  </div>
                )}
              </div>

              {/* Tags */}
              {tags.length > 0 && (
                <div className="pt-6 border-t border-neutral-200 dark:border-[#181818] flex flex-wrap gap-2 transition-colors duration-200">
                  {tags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="text-[10px] font-mono text-neutral-600 dark:text-neutral-400 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 px-2 py-0.5 rounded-[2px]"
                    >
                      #{tag.toLowerCase()}
                    </span>
                  ))}
                </div>
              )}
            </>
          )}

        </section>

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
