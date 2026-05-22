import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { supabase } from "../utils/supabaseClient";
import ThemeToggle from "../components/ThemeToggle";

export default function ReelDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [reel, setReel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);

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

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-[#0a0a0a] text-neutral-900 dark:text-neutral-100 flex flex-col items-center justify-center gap-3 transition-colors duration-200">
        <div className="w-8 h-8 border-2 border-neutral-800 dark:border-emerald-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-mono text-neutral-500">Decrypting and loading analysis...</p>
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
        
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-xs font-mono text-rose-600 hover:text-rose-500 dark:text-rose-400 dark:hover:text-rose-300 border border-rose-500/20 hover:border-rose-500/50 bg-rose-500/5 px-3 py-1.5 rounded-[3px] transition-all disabled:opacity-50"
          >
            {deleting ? "Deleting..." : "Delete Save"}
          </button>
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
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
              {metadata.title || "Untitled AI Import"}
            </h1>
            <p className="text-xs font-mono text-neutral-400 dark:text-neutral-500 mt-2">
              Analyzed on: {reel.analyzed_at ? new Date(reel.analyzed_at).toLocaleString() : "Pending"}
            </p>
          </div>

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

            {/* Extracted URLs */}
            <div className="bg-white dark:bg-[#0b0b0b] border border-neutral-200 dark:border-[#161616] p-5 rounded-[3px] transition-colors duration-200">
              <h3 className="text-xs font-mono uppercase tracking-wider text-neutral-450 dark:text-neutral-400 mb-3">Extracted Resources</h3>
              {urls.length > 0 ? (
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
          <div className="border border-neutral-200 dark:border-[#181818] rounded-[3px] overflow-hidden transition-colors duration-200">
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

        </section>

      </div>
    </div>
  );
}
