import React, { useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { supabase } from "../utils/supabaseClient";

import { Button } from "components/ui/button";

export default function ReelCard({ reel, collections = [], onRefreshCollections }) {
  const { id, thumbnail_url, analysis_status, reel_metadata } = reel;
  const title = reel.title || reel_metadata?.title || "Untitled Import";
  const content_type = reel.content_type || reel_metadata?.content_type;
  
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(false);

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
    <div className="group relative w-full rounded-[1.5rem] overflow-hidden bg-[#FAFAF8] dark:bg-[#0A0B0D] border border-[#E3E3DF] dark:border-[#1A1D22] shadow-[0_2px_10px_rgba(0,0,0,0.02)] dark:shadow-none transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:shadow-xl dark:hover:border-white/10">
      <Link to={`/imports/${id}`} className="block w-full h-full">
        {thumbnail_url ? (
          <div className="w-full h-full overflow-hidden">
            <img
              src={thumbnail_url}
              alt={title}
              className="w-full h-auto object-cover block transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-[1.04]"
              loading="lazy"
            />
          </div>
        ) : (
          <div className="w-full h-48 flex items-center justify-center text-[#6B7280] dark:text-[#8B93A1] bg-[#F1F1EE] dark:bg-[#0E1013] text-xs font-mono">
            NO IMAGE
          </div>
        )}
        {/* Persistent Overlays */}
        {content_type && (
          <div className="absolute top-3 left-3 z-20 pointer-events-none transition-opacity duration-300 group-hover:opacity-0">
            <div className="bg-white/90 backdrop-blur-md border border-black/5 rounded-full px-3 py-1 shadow-sm flex items-center justify-center">
              <span className="text-[10px] font-bold tracking-[0.15em] uppercase text-black/90 leading-none pt-[1px]">{content_type}</span>
            </div>
          </div>
        )}

        {/* Hover Scrim Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] flex flex-col justify-between p-6 pointer-events-none">
          <div className="flex justify-end relative z-20">
             {/* Spacer for top right save button */}
          </div>
          <div className="text-white mt-auto transform translate-y-8 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] delay-[50ms]">
            <div className="w-8 h-[2px] bg-white/30 mb-3.5 rounded-full"></div>
            <h3 className="font-medium text-[24px] leading-[1.15] tracking-[-0.03em] text-white/95 drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)] line-clamp-3 mb-2">{title}</h3>
            {analysis_status === "pending" && (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-300">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span> Processing AI
              </span>
            )}
            {analysis_status === "failed" && (
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-400">Analysis Failed</span>
            )}
          </div>
        </div>
      </Link>

      {/* Save Button Overlay */}
      <div className="absolute top-3 right-3 opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] z-10">
        <div className="relative">
          <Button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDropdownOpen(!dropdownOpen); }}
            className="group/btn rounded-full bg-[#111111]/95 dark:bg-[#F2F2F0]/95 backdrop-blur-md text-[#FAFAF8] dark:text-[#111111] font-bold h-8 pl-3.5 pr-1 shadow-xl transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:scale-[1.05] active:scale-[0.95] flex items-center gap-2"
          >
            <span className="text-[11px] tracking-wide">Save</span>
            <div className="w-6 h-6 rounded-full bg-white/20 dark:bg-black/10 flex items-center justify-center transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover/btn:scale-110">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"></path></svg>
            </div>
          </Button>

          {dropdownOpen && (
            <div className="absolute right-0 top-12 w-48 bg-[#FAFAF8] dark:bg-[#0A0B0D] border border-[#E3E3DF] dark:border-[#1A1D22] rounded-[16px] shadow-xl p-2 z-30 space-y-1">
              <p className="text-[12px] font-bold text-[#6B7280] dark:text-[#8B93A1] uppercase tracking-wider px-2 py-1 mb-1">
                Save to board
              </p>
              <div className="max-h-48 overflow-y-auto">
                {collections.length === 0 ? (
                  <p className="text-[12px] font-semibold text-[#6B7280] dark:text-[#8B93A1] px-2 py-1.5 italic">
                    No boards
                  </p>
                ) : (
                  collections.map((col) => {
                    const isAdded = col.reel_collections?.some(rc => rc.reel_id === id);
                    return (
                      <button
                        key={col.id}
                        disabled={loading}
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleToggleCollection(col.id, isAdded); }}
                        className="w-full text-left text-[14px] font-semibold hover:bg-[#F1F1EE] dark:hover:bg-[#0E1013] px-3 py-2 rounded-xl transition-colors flex items-center justify-between text-[#111111] dark:text-[#F2F2F0]"
                      >
                        <span className="truncate pr-2">{col.name}</span>
                        {isAdded && <span className="text-[#111111] dark:text-[#F2F2F0] font-bold">✓</span>}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
