import React, { useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { supabase } from "../utils/supabaseClient";

export default function ReelCard({ reel, collections = [], onRefreshCollections }) {
  const { id, thumbnail_url, analysis_status, reel_metadata } = reel;
  const title = reel.title || reel_metadata?.title;
  const content_type = reel.content_type || reel_metadata?.content_type;
  
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Status-specific badges
  const statusConfig = {
    completed: {
      bg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
      text: "Completed",
      indicator: "bg-emerald-500"
    },
    failed: {
      bg: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
      text: "Failed",
      indicator: "bg-rose-500"
    },
    pending: {
      bg: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
      text: "Processing",
      indicator: "bg-amber-500 animate-pulse"
    }
  };

  const currentStatus = statusConfig[analysis_status] || statusConfig.pending;

  const handleToggleCollection = async (collectionId, isAdded) => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;

      if (isAdded) {
        // Remove from collection
        await axios.delete(`http://localhost:5000/api/collections/${collectionId}/reels/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        // Add to collection
        await axios.post(`http://localhost:5000/api/collections/${collectionId}/reels`, 
          { reelId: id },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }
      if (onRefreshCollections) onRefreshCollections();
    } catch (err) {
      console.error("Error managing reel collection:", err);
      alert("Failed to update collection.");
    } finally {
      setLoading(false);
      setDropdownOpen(false);
    }
  };

  return (
    <div aria-label="Reel Card" className="group relative flex flex-col bg-white dark:bg-[#0d0d0d] border border-neutral-300 dark:border-[#181818] hover:border-neutral-400 dark:hover:border-neutral-750 hover:shadow-sm transition-all duration-300 rounded-[20px] overflow-hidden">
      <Link to={`/imports/${id}`} className="flex flex-col">
        {/* Thumbnail Container */}
        <div className={`relative w-full overflow-hidden border-b border-neutral-200 dark:border-[#181818] ${
          thumbnail_url ? "bg-transparent" : "h-36 bg-neutral-100 dark:bg-[#141414]"
        }`}>
          {thumbnail_url ? (
            <img
              src={thumbnail_url}
              alt={title || "Reel Thumbnail"}
              className="w-full h-auto object-cover group-hover:scale-102 transition-transform duration-500 ease-out"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-neutral-400 dark:text-neutral-600 text-xs font-mono">
              NO IMAGE
            </div>
          )}
          
          {content_type && (
            <span className="absolute top-2 right-2 px-2 py-0.5 text-[9px] font-mono tracking-wider uppercase bg-white/90 dark:bg-black/80 text-neutral-800 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-800 rounded-[2px]">
              {content_type}
            </span>
          )}

          <div className="absolute bottom-2 left-2 flex items-center gap-1.5 px-2 py-0.5 text-[9px] font-mono uppercase bg-white/90 dark:bg-black/85 text-neutral-750 dark:text-neutral-400 rounded-[2px] border border-neutral-200 dark:border-neutral-800">
            <span className={`w-1.5 h-1.5 rounded-full ${currentStatus.indicator}`} />
            <span className="text-neutral-600 dark:text-neutral-400">{currentStatus.text}</span>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 flex flex-col justify-between">
          <h3 className="text-xs font-bold text-neutral-900 dark:text-neutral-100 line-clamp-2 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors duration-200 font-sans leading-tight">
            {title || "Untitled Import"}
          </h3>
        </div>
      </Link>

      {/* Save to Collection action bar */}
      <div className="px-4 pb-4 flex justify-between items-center z-10 border-t border-neutral-100 dark:border-[#141414] pt-3 mt-auto">
        <span className="text-[10px] font-mono text-neutral-400 dark:text-neutral-500">
          SuperBrain Intelligence
        </span>
        
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="text-[10px] font-mono text-emerald-600 hover:text-emerald-500 dark:text-emerald-450 dark:hover:text-emerald-400 flex items-center gap-1 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 px-2 py-1 rounded-[3px] transition-colors"
          >
            <span>📁 Save</span>
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 bottom-full mb-2 w-48 bg-white dark:bg-[#0d0d0d] border border-neutral-200 dark:border-[#1c1c1c] rounded-[3px] shadow-xl p-2 z-20 space-y-1">
              <p className="text-[9px] font-mono text-neutral-400 dark:text-neutral-550 uppercase tracking-wider px-2 py-1 border-b border-neutral-100 dark:border-neutral-900">
                Choose Collection
              </p>
              {collections.length === 0 ? (
                <p className="text-[10px] font-mono text-neutral-400 dark:text-neutral-600 px-2 py-1.5 italic">
                  No collections created
                </p>
              ) : (
                collections.map((col) => {
                  const isAdded = col.reel_collections?.some(rc => rc.reel_id === id);
                  return (
                    <button
                      key={col.id}
                      disabled={loading}
                      onClick={() => handleToggleCollection(col.id, isAdded)}
                      className="w-full text-left text-[11px] font-mono hover:bg-neutral-50 dark:hover:bg-neutral-900 px-2 py-1.5 rounded-[2px] transition-colors flex items-center justify-between text-neutral-700 dark:text-neutral-300"
                    >
                      <span className="truncate">{col.name}</span>
                      <span>{isAdded ? "✓" : "+"}</span>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
