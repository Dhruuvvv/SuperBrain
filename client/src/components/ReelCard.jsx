import React from "react";
import { Link } from "react-router-dom";

export default function ReelCard({ reel }) {
  const {
    id,
    //author_username,
    thumbnail_url,
    analysis_status,
    //error_message,
    reel_metadata
  } = reel;

  // Handle both flat and nested models
  const title = reel.title || reel_metadata?.title;
  //const summary = reel.summary || reel_metadata?.summary;
  const content_type = reel.content_type || reel_metadata?.content_type;
  //const tags = reel.tags || reel_metadata?.tags || [];

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

  return (
    <Link
      to={`/imports/${id}`}
      className="group flex flex-col bg-white dark:bg-[#0d0d0d] border border-neutral-300 dark:border-[#181818] hover:border-neutral-400 dark:hover:border-neutral-750 hover:shadow-sm transition-all duration-300 rounded-[20px] overflow-hidden"
    >
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
        
        {/* Content Type Badge */}
        {content_type && (
          <span className="absolute top-2 right-2 px-2 py-0.5 text-[9px] font-mono tracking-wider uppercase bg-white/90 dark:bg-black/80 text-neutral-800 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-800 rounded-[2px]">
            {content_type}
          </span>
        )}

        {/* Status Indicator */}
        <div className="absolute bottom-2 left-2 flex items-center gap-1.5 px-2 py-0.5 text-[9px] font-mono uppercase bg-white/90 dark:bg-black/85 text-neutral-750 dark:text-neutral-400 rounded-[2px] border border-neutral-200 dark:border-neutral-800">
          <span className={`w-1.5 h-1.5 rounded-full ${currentStatus.indicator}`} />
          <span className="text-neutral-600 dark:text-neutral-400">{currentStatus.text}</span>
        </div>
      </div>

      {/* Content Body */}
      <div className="flex-1 p-4 flex flex-col justify-between">
        <div>
          {/* Author */}
          {/* {author_username && (
            <div className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 mb-1">
              @{author_username}
            </div>
          )} */}

          {/* Title */}
          <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 line-clamp-1 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors duration-200">
            {title || "Untitled Import"}
          </h3>

          {/* Summary / Error Info */}
          {/* {analysis_status === "failed" ? (
            <p className="text-[11px] text-rose-600 dark:text-rose-450 font-mono mt-1.5 line-clamp-2 bg-rose-500/5 p-1.5 border border-rose-500/10 rounded-[2px]">
              Error: {error_message || "AI Analysis Failed"}
            </p>
          ) : (
            <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1.5 line-clamp-2 leading-relaxed">
              {summary || "Waiting for summary details..."}
            </p>
          )} */}
        </div>

        {/* Tags */}
        {/* {tags && tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1">
            {tags.slice(0, 3).map((tag, idx) => (
              <span
                key={idx}
                className="text-[9px] font-mono text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-[#161616] px-1.5 py-0.5 border border-neutral-200 dark:border-[#252525] rounded-[2px]"
              >
                #{tag.toLowerCase()}
              </span>
            ))}
            {tags.length > 3 && (
              <span className="text-[9px] font-mono text-neutral-400 dark:text-neutral-600 px-1 py-0.5">
                +{tags.length - 3}
              </span>
            )}
          </div>
        )} */}
      </div>
    </Link>
  );
}
