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
            <div className="min-h-screen bg-neutral-50 dark:bg-[#050505] flex flex-col items-center justify-center relative overflow-hidden">
                <div className="flex flex-col items-center gap-6 z-10 animate-in fade-in duration-1000">
                    <div className="relative flex items-center justify-center w-12 h-12">
                        <div className="absolute inset-0 border border-black/10 dark:border-white/10 rounded-full"></div>
                        <div className="absolute inset-0 border-[1.5px] border-black dark:border-white rounded-full animate-[spin_1.5s_cubic-bezier(0.65,0,0.35,1)_infinite] border-t-transparent border-r-transparent"></div>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-900 dark:text-white">
                            <path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z"></path>
                        </svg>
                    </div>
                    <div className="flex flex-col items-center gap-2 text-center">
                        <h3 className="font-sans font-medium text-sm text-neutral-900 dark:text-white tracking-wide">Syncing Workspace</h3>
                        <p className="text-[10px] font-sans text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.2em]">Retrieving content hub</p>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-neutral-50 dark:bg-[#050505] text-neutral-900 dark:text-neutral-100 pt-32 pb-12 px-6 md:px-12 transition-colors duration-500 relative overflow-hidden">
            
            {/* Ambient Background Glow */}
            <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-500/5 dark:bg-emerald-500/10 blur-[120px] pointer-events-none" />

            <div className="max-w-5xl mx-auto relative z-10">
                {/* Header section */}
                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 mb-12">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-medium mb-4">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            Admin Control
                        </div>
                        <h2 className="text-4xl md:text-5xl font-normal text-neutral-900 dark:text-white mt-2">
                            Second Brain Content
                            <span className="ml-3 text-2xl text-neutral-400 dark:text-neutral-600 font-sans not-italic font-light tracking-tight">({reels.length})</span>
                        </h2>
                    </div>
                    
                    <button 
                        onClick={fetchReels}
                        className="group flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-[#111111] border border-neutral-200 dark:border-white/10 hover:border-neutral-300 dark:hover:border-white/20 text-sm font-medium rounded-full transition-all duration-300 shadow-sm hover:shadow-md active:scale-95"
                    >
                        <span className="group-hover:rotate-180 transition-transform duration-500">🔄</span> 
                        Refresh Data
                    </button>
                </div>

                {/* Error alerts */}
                {error && (
                    <div className="mb-8 px-5 py-4 rounded-2xl text-sm bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 backdrop-blur-md">
                        <span className="font-bold mr-2">Error:</span> {error}
                    </div>
                )}

                {/* Content list (Double Bezel) */}
                <div className="relative w-full p-2 bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.05] dark:border-white/[0.05] rounded-[2.5rem]">
                    <div className="bg-white dark:bg-[#0A0A0A] border border-neutral-200 dark:border-white/10 rounded-[calc(2.5rem-8px)] overflow-hidden shadow-xl p-2 sm:p-4 min-h-[400px]">
                        {reels.length === 0 ? (
                            <div className="p-20 text-center flex flex-col items-center justify-center">
                                <div className="w-16 h-16 mb-4 rounded-full bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center text-2xl">🎥</div>
                                <h3 className="text-lg font-medium text-neutral-900 dark:text-white">No content found</h3>
                                <p className="text-sm text-neutral-500 mt-1">Upload a reel or carousel post on the Dashboard!</p>
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
                                <div key={r.id} className="bg-neutral-50 dark:bg-white/[0.02] border border-neutral-200 dark:border-white/5 rounded-2xl overflow-hidden shadow-sm transition-all duration-300 hover:border-neutral-300 dark:hover:border-white/10">
                                    
                                    {/* Collapsed Header */}
                                    <div 
                                        onClick={() => toggleExpand(r.id)}
                                        className="flex items-center justify-between p-5 cursor-pointer hover:bg-white dark:hover:bg-white/[0.04] transition-colors duration-300 gap-4"
                                    >
                                        <div className="flex items-center gap-4 min-w-0">
                                            {/* Thumbnail block */}
                                            <div className="w-12 h-12 rounded-xl overflow-hidden bg-neutral-100 dark:bg-neutral-900 border border-black/5 dark:border-white/10 flex items-center justify-center flex-shrink-0 shadow-inner">
                                                {r.thumbnail_url ? (
                                                    <img src={r.thumbnail_url} alt="Thumbnail preview" className="w-full h-full object-cover" />
                                                ) : (
                                                    <span className="text-xs">🎥</span>
                                                )}
                                            </div>

                                            {/* Metadata texts */}
                                            <div className="min-w-0">
                                                <h3 className="text-lg font-normal tracking-wide text-neutral-900 dark:text-white truncate">
                                                    {hasMeta ? meta.title : (r.title || "Untitled AI Import")}
                                                </h3>
                                                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-neutral-500 font-sans mt-1">
                                                    <span className="text-emerald-600 dark:text-emerald-450 font-medium">@{r.author_username || "unknown"}</span>
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
                                            <span className={`px-2.5 py-1 text-[10px] font-semibold tracking-wider uppercase rounded-full border ${statusColor}`}>
                                                {r.analysis_status || "pending"}
                                            </span>
                                            <span className="text-neutral-400 font-mono text-[9px]">
                                                {isExpanded ? "▲" : "▼"}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Expanded Drawer */}
                                    {isExpanded && (
                                        <div className="px-6 pb-6 pt-4 border-t border-neutral-200 dark:border-white/5 bg-white dark:bg-[#0A0A0A] space-y-6 text-sm">
                                            
                                            {/* Instagram Link */}
                                            {r.instagram_url && (
                                                <div className="font-mono text-xs text-neutral-500 break-all bg-neutral-50 dark:bg-[#111] p-3 border border-neutral-200 dark:border-white/5 rounded-xl">
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
                                                            <span className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider bg-neutral-100 dark:bg-white/5 border border-neutral-200 dark:border-white/10 text-neutral-800 dark:text-neutral-300 rounded-full">
                                                                Type: {meta.content_type}
                                                            </span>
                                                        )}
                                                        {meta.language_detected && (
                                                            <span className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider bg-neutral-100 dark:bg-white/5 border border-neutral-200 dark:border-white/10 text-neutral-800 dark:text-neutral-300 rounded-full">
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
            </div>
        </div>
    )
}
