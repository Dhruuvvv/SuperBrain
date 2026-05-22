import { useEffect, useState } from "react"
import { supabase } from "../utils/supabaseClient"
import ThemeToggle from "../components/ThemeToggle"

export default function Reels() {
    const [reels, setReels] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState("")
    const [expandedReelId, setExpandedReelId] = useState(null)

    useEffect(() => {
        fetchReels()
    }, [])

    async function fetchReels() {
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from("reels")
                .select(`
                    *,
                    reel_metadata (*)
                `)
                .order("created_at", { ascending: false })

            if (error) throw error
            setReels(data || [])
        } catch (err) {
            console.error("Reels fetch error:", err)
            setError("Reels load nahi thai sake: " + err.message)
        } finally {
            setLoading(false)
        }
    }

    const toggleExpand = (id) => {
        setExpandedReelId(expandedReelId === id ? null : id)
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-neutral-50 dark:bg-[#0a0a0a] text-neutral-900 dark:text-neutral-100 flex flex-col items-center justify-center gap-3">
                <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                <p className="text-xs font-mono text-neutral-500">Retrieving Second Brain content hub...</p>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-neutral-55 dark:bg-[#0a0a0a] text-neutral-900 dark:text-neutral-100 p-6 md:p-12 transition-colors duration-200">
            
            {/* Header section with count, refresh and theme toggle */}
            <div className="max-w-4xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                <div>
                    <span className="text-[10px] font-mono tracking-widest uppercase text-emerald-500 dark:text-emerald-400">Admin Control</span>
                    <h2 className="text-xl font-bold font-mono tracking-tight mt-1">
                      🎥 Second Brain Content Hub ({reels.length})
                    </h2>
                </div>
                
                <div className="flex items-center gap-3">
                    <button 
                        onClick={fetchReels}
                        className="px-3.5 py-2 text-xs font-mono border border-neutral-200 dark:border-[#222] hover:border-neutral-450 dark:hover:border-neutral-700 bg-white dark:bg-[#0d0d0d] rounded-[3px] transition-colors"
                    >
                        🔄 Refresh
                    </button>
                    <ThemeToggle />
                </div>
            </div>

            {/* Error alerts */}
            {error && (
                <div className="max-w-4xl mx-auto mb-6 px-4 py-3 rounded-[3px] text-xs font-mono bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                    ⚠️ {error}
                </div>
            )}

            {/* Content list */}
            <div className="max-w-4xl mx-auto space-y-4">
                {reels.length === 0 ? (
                    <div className="p-12 text-center bg-white dark:bg-[#0d0d0d] border border-neutral-200 dark:border-[#181818] text-xs font-mono text-neutral-500 rounded-[3px]">
                        No processed content found yet. Upload a reel or carousel post on the Dashboard!
                    </div>
                ) : (
                    <div className="space-y-3">
                        {reels.map((r) => {
                            const meta = r.reel_metadata?.[0] || r.reel_metadata; // Supabase returns object or array of 1
                            const hasMeta = !!meta;
                            const isExpanded = expandedReelId === r.id;

                            // Status tags configuration
                            const statusColor = r.analysis_status === "completed" 
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" 
                                : r.analysis_status === "failed" 
                                    ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20" 
                                    : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";

                            return (
                                <div key={r.id} className="bg-white dark:bg-[#0d0d0d] border border-neutral-200 dark:border-[#181818] rounded-[3px] overflow-hidden shadow-sm">
                                    
                                    {/* Collapsed Header */}
                                    <div 
                                        onClick={() => toggleExpand(r.id)}
                                        className="flex items-center justify-between p-4 cursor-pointer hover:bg-neutral-50 dark:hover:bg-[#121212] transition-colors duration-150 gap-4"
                                    >
                                        <div className="flex items-center gap-4 min-w-0">
                                            {/* Thumbnail block */}
                                            <div className="w-12 h-12 rounded-[2px] overflow-hidden bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex items-center justify-center flex-shrink-0">
                                                {r.thumbnail_url ? (
                                                    <img src={r.thumbnail_url} alt="Thumbnail preview" className="w-full h-full object-cover" />
                                                ) : (
                                                    <span className="text-xs">🎥</span>
                                                )}
                                            </div>

                                            {/* Metadata texts */}
                                            <div className="min-w-0">
                                                <h3 className="text-xs font-bold text-neutral-900 dark:text-neutral-100 truncate">
                                                    {hasMeta ? meta.title : (r.title || "Untitled AI Import")}
                                                </h3>
                                                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-neutral-500 font-mono mt-0.5">
                                                    <span className="text-emerald-600 dark:text-emerald-450 font-bold">@{r.author_username || "unknown"}</span>
                                                    <span>•</span>
                                                    <span>{new Date(r.created_at).toLocaleDateString()}</span>
                                                    {r.duration_seconds && (
                                                        <>
                                                            <span>•</span>
                                                            <span>{r.duration_seconds}s</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Status & Toggle arrow */}
                                        <div className="flex items-center gap-3 flex-shrink-0">
                                            <span className={`px-2 py-0.5 text-[9px] font-mono uppercase rounded-[2px] border ${statusColor}`}>
                                                {r.analysis_status || "pending"}
                                            </span>
                                            <span className="text-neutral-400 font-mono text-[9px]">
                                                {isExpanded ? "▲" : "▼"}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Expanded Drawer */}
                                    {isExpanded && (
                                        <div className="px-6 pb-6 pt-2 border-t border-neutral-150 dark:border-[#181818] bg-neutral-50/50 dark:bg-[#090909]/40 space-y-5 text-xs">
                                            
                                            {/* Instagram Link */}
                                            {r.instagram_url && (
                                                <div className="font-mono text-[10px] text-neutral-500 break-all bg-white dark:bg-[#111] p-3 border border-neutral-200 dark:border-neutral-800 rounded-[2px]">
                                                    <span className="font-bold text-neutral-600 dark:text-neutral-400">Instagram Link: </span>
                                                    <a href={r.instagram_url} target="_blank" rel="noopener noreferrer" className="text-emerald-600 dark:text-emerald-450 hover:underline">
                                                        {r.instagram_url}
                                                    </a>
                                                </div>
                                            )}

                                            {!hasMeta ? (
                                                <p className="italic text-neutral-500 font-mono">
                                                    {r.analysis_status === "failed" ? "❌ AI analysis pipeline failed for this record." : "⏳ AI metadata and transcript calculation is pending. Reload in a moment..."}
                                                </p>
                                            ) : (
                                                <div className="space-y-5">
                                                    {/* Content details and language flags */}
                                                    <div className="flex gap-2">
                                                        {meta.content_type && (
                                                            <span className="px-2.5 py-0.5 text-[9px] font-mono uppercase bg-neutral-200 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-300 rounded-[2px]">
                                                                Type: {meta.content_type}
                                                            </span>
                                                        )}
                                                        {meta.language_detected && (
                                                            <span className="px-2.5 py-0.5 text-[9px] font-mono uppercase bg-neutral-200 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-300 rounded-[2px]">
                                                                Language: {meta.language_detected}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Summary */}
                                                    <div className="space-y-1">
                                                        <h4 className="font-mono text-[10px] text-neutral-500 uppercase tracking-wider">Curation Summary</h4>
                                                        <p className="text-neutral-750 dark:text-neutral-350 leading-relaxed font-sans text-xs bg-white dark:bg-[#111] p-4 border border-neutral-150 dark:border-neutral-800 rounded-[2px]">
                                                            {meta.summary}
                                                        </p>
                                                    </div>

                                                    {/* Brand names & tools tags */}
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        {meta.mentioned_brand_names && meta.mentioned_brand_names.length > 0 && (
                                                            <div className="bg-white dark:bg-[#111] p-4 border border-neutral-150 dark:border-neutral-800 rounded-[2px]">
                                                                <span className="font-mono text-[10px] text-neutral-500 uppercase tracking-wider block mb-2">Mentioned Brands</span>
                                                                <div className="flex flex-wrap gap-1.5">
                                                                    {meta.mentioned_brand_names.map((brand, i) => (
                                                                        <span key={i} className="text-[10px] font-mono px-2 py-0.5 bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-400 rounded-[2px]">{brand}</span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {meta.mentioned_tools && meta.mentioned_tools.length > 0 && (
                                                            <div className="bg-white dark:bg-[#111] p-4 border border-neutral-150 dark:border-neutral-800 rounded-[2px]">
                                                                <span className="font-mono text-[10px] text-neutral-500 uppercase tracking-wider block mb-2">Tools & Services</span>
                                                                <div className="flex flex-wrap gap-1.5">
                                                                    {meta.mentioned_tools.map((tool, i) => (
                                                                        <span key={i} className="text-[10px] font-mono px-2 py-0.5 bg-emerald-500/5 border border-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-[2px]">{tool}</span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Actionable Resources / URLs */}
                                                    {meta.extracted_urls && meta.extracted_urls.length > 0 && (
                                                        <div className="space-y-2">
                                                            <h4 className="font-mono text-[10px] text-neutral-500 uppercase tracking-wider">Resources & External Links</h4>
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                                {meta.extracted_urls.map((url, i) => (
                                                                    <a 
                                                                        key={i} 
                                                                        href={url} 
                                                                        target="_blank" 
                                                                        rel="noopener noreferrer" 
                                                                        className="flex items-center gap-2 p-3 bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 hover:border-neutral-350 dark:hover:border-neutral-700 rounded-[2px] transition-colors"
                                                                    >
                                                                        <span className="text-sm">🔗</span>
                                                                        <span className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400 truncate">{url.replace(/^https?:\/\/(www\.)?/, "")}</span>
                                                                    </a>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Key Takeaways */}
                                                    {meta.key_takeaways && meta.key_takeaways.length > 0 && (
                                                        <div className="space-y-2">
                                                            <h4 className="font-mono text-[10px] text-neutral-500 uppercase tracking-wider">Key Takeaways</h4>
                                                            <ul className="space-y-2">
                                                                {meta.key_takeaways.map((takeaway, i) => (
                                                                    <li key={i} className="flex gap-2.5 items-start text-neutral-750 dark:text-neutral-305">
                                                                        <span className="text-emerald-600 dark:text-emerald-400 font-bold select-none">•</span>
                                                                        <span>{takeaway}</span>
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )}

                                                    {/* Practical Guides */}
                                                    {meta.how_to_guide && (
                                                        <div className="bg-emerald-500/5 border border-emerald-500/10 p-5 rounded-[2px]">
                                                            <h4 className="font-mono font-bold text-emerald-700 dark:text-emerald-400 text-xs mb-3 flex items-center gap-1.5">
                                                                <span>📋</span>
                                                                <span>{meta.how_to_guide.how_to_title || "How-To Stepwise Guide"}</span>
                                                            </h4>
                                                            
                                                            {meta.how_to_guide.materials_needed && meta.how_to_guide.materials_needed.length > 0 && (
                                                                <div className="text-[10px] font-mono text-neutral-500 mb-3 bg-white dark:bg-[#111]/30 p-2 rounded-[2px]">
                                                                    <strong className="text-neutral-600 dark:text-neutral-400">Required: </strong>
                                                                    <span>{meta.how_to_guide.materials_needed.join(", ")}</span>
                                                                </div>
                                                            )}
                                                            
                                                            <div className="space-y-2.5">
                                                                {meta.how_to_guide.steps && meta.how_to_guide.steps.map((step, i) => (
                                                                    <div key={i} className="flex gap-2.5 items-start text-neutral-700 dark:text-neutral-300">
                                                                        <span className="w-4 h-4 bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-mono flex items-center justify-center rounded-full flex-shrink-0 mt-0.5">{i + 1}</span>
                                                                        <span>{step}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                            
                                                            {meta.how_to_guide.estimated_time && (
                                                                <div className="text-[10px] font-mono text-emerald-600 dark:text-emerald-450 mt-4 pt-3 border-t border-emerald-500/10">
                                                                    ⏱️ Estimated Effort: {meta.how_to_guide.estimated_time}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Visual Context */}
                                                    {meta.visual_description && (
                                                        <div className="space-y-1">
                                                            <h4 className="font-mono text-[10px] text-neutral-500 uppercase tracking-wider">Visual Context details</h4>
                                                            <p className="text-[11px] leading-relaxed text-neutral-500 font-mono bg-white dark:bg-[#111] p-3 border border-neutral-150 dark:border-neutral-800 rounded-[2px]">
                                                                {meta.visual_description}
                                                            </p>
                                                        </div>
                                                    )}

                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
