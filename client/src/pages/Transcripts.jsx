import { useEffect, useState } from "react"
import { supabase } from "../utils/supabaseClient"
import ThemeToggle from "../components/ThemeToggle"

export default function Transcripts() {
    const [data, setData] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState("")

    useEffect(() => {
        fetchData()
    }, [])

    async function fetchData() {
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from("transcripts")
                .select("*, reels!inner(instagram_url)")
                .order("created_at", { ascending: false })

            if (error) throw error
            setData(data || [])
        } catch (err) {
            console.error("Transcripts fetch error:", err)
            setError("Transcripts load nahi thai sake: " + err.message)
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-neutral-50 dark:bg-[#0a0a0a] text-neutral-900 dark:text-neutral-100 flex flex-col items-center justify-center gap-3">
                <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                <p className="text-xs font-mono text-neutral-500">Querying transcript datasets...</p>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-neutral-55 dark:bg-[#0a0a0a] text-neutral-900 dark:text-neutral-100 p-6 md:p-12 transition-colors duration-200">
            
            {/* Header section with count, refresh and theme toggle */}
            <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                <div>
                    <span className="text-[10px] font-mono tracking-widest uppercase text-emerald-500 dark:text-emerald-400">Admin Control</span>
                    <h2 className="text-xl font-bold font-mono tracking-tight mt-1">
                      📝 Audio Transcripts ({data.length})
                    </h2>
                </div>
                
                <div className="flex items-center gap-3">
                    <button 
                        onClick={fetchData}
                        className="px-3.5 py-2 text-xs font-mono border border-neutral-200 dark:border-[#222] hover:border-neutral-450 dark:hover:border-neutral-700 bg-white dark:bg-[#0d0d0d] rounded-[3px] transition-colors"
                    >
                        🔄 Refresh
                    </button>
                    <ThemeToggle />
                </div>
            </div>

            {/* Error alerts */}
            {error && (
                <div className="max-w-6xl mx-auto mb-6 px-4 py-3 rounded-[3px] text-xs font-mono bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                    ⚠️ {error}
                </div>
            )}

            {/* Main Table / Grid */}
            <div className="max-w-6xl mx-auto bg-white dark:bg-[#0d0d0d] border border-[#181818] rounded-[3px] overflow-hidden shadow-sm">
                {data.length === 0 ? (
                    <div className="p-12 text-center text-xs font-mono text-neutral-500">
                        No audio transcripts exist in the system.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left text-xs">
                            <thead>
                                <tr className="bg-neutral-50 dark:bg-[#111] border-b border-neutral-200 dark:border-[#181818] text-neutral-500 uppercase tracking-wider font-mono">
                                    <th className="px-6 py-4 font-bold">Media Source</th>
                                    <th className="px-6 py-4 font-bold">Transcript Preview</th>
                                    <th className="px-6 py-4 font-bold">Words</th>
                                    <th className="px-6 py-4 font-bold">Language</th>
                                    <th className="px-6 py-4 font-bold text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-200 dark:divide-[#181818]">
                                {data.map((t) => (
                                    <tr key={t.id} className="hover:bg-neutral-50 dark:hover:bg-[#141414] transition-colors duration-150">
                                        <td className="px-6 py-4 font-mono">
                                            <a 
                                                href={t.reels?.instagram_url} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                                            >
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                </svg>
                                                Instagram Reel
                                            </a>
                                        </td>
                                        <td className="px-6 py-4 max-w-xs md:max-w-md">
                                            <p className="text-neutral-700 dark:text-neutral-300 truncate leading-relaxed">
                                                {t.plain_text || <span className="text-neutral-400 italic">No audio/speech text detected</span>}
                                            </p>
                                        </td>
                                        <td className="px-6 py-4 font-mono text-neutral-600 dark:text-neutral-400">
                                            {t.word_count || 0}
                                        </td>
                                        <td className="px-6 py-4 font-mono uppercase text-[10px] text-neutral-500">
                                            {t.language_detected || "N/A"}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`inline-flex px-2 py-0.5 text-[9px] font-mono uppercase rounded-[2px] border ${
                                                t.transcription_status === "completed" 
                                                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" 
                                                    : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                                            }`}>
                                                {t.transcription_status || "pending"}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    )
}
