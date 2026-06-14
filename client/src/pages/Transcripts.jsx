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
                        <p className="text-[10px] font-sans text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.2em]">Retrieving transcripts</p>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-neutral-50 dark:bg-[#050505] text-neutral-900 dark:text-neutral-100 pt-32 pb-12 px-6 md:px-12 transition-colors duration-500 relative overflow-hidden">
            
            {/* Ambient Background Glow */}
            <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-500/5 dark:bg-emerald-500/10 blur-[120px] pointer-events-none" />

            <div className="max-w-6xl mx-auto relative z-10">
                {/* Header section */}
                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 mb-12">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-medium mb-4">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            Admin Control
                        </div>
                        <h2 className="text-4xl md:text-5xl font-normal text-neutral-900 dark:text-white mt-2">
                            Audio Transcripts
                            <span className="ml-3 text-2xl text-neutral-400 dark:text-neutral-600 font-sans not-italic font-light tracking-tight">({data.length})</span>
                        </h2>
                    </div>
                    
                    <button 
                        onClick={fetchData}
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

                {/* Main Content Area (Double Bezel) */}
                <div className="relative w-full p-2 bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.05] dark:border-white/[0.05] rounded-[2.5rem]">
                    <div className="bg-white dark:bg-[#0A0A0A] border border-neutral-200 dark:border-white/10 rounded-[calc(2.5rem-8px)] overflow-hidden shadow-xl">
                        {data.length === 0 ? (
                            <div className="p-20 text-center flex flex-col items-center justify-center">
                                <div className="w-16 h-16 mb-4 rounded-full bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center text-2xl">📝</div>
                                <h3 className="text-lg font-medium text-neutral-900 dark:text-white">No transcripts found</h3>
                                <p className="text-sm text-neutral-500 mt-1">There are no audio transcripts in the system yet.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead>
                                        <tr className="border-b border-neutral-200 dark:border-white/10 bg-neutral-50/50 dark:bg-white/[0.02]">
                                            <th className="px-8 py-5 font-medium text-neutral-500 dark:text-neutral-400">Media Source</th>
                                            <th className="px-8 py-5 font-medium text-neutral-500 dark:text-neutral-400">Transcript Preview</th>
                                            <th className="px-8 py-5 font-medium text-neutral-500 dark:text-neutral-400 text-center">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-neutral-200 dark:divide-white/5">
                                        {data.map((t) => (
                                            <tr key={t.id} className="group hover:bg-neutral-50/50 dark:hover:bg-white/[0.02] transition-colors duration-300">
                                                <td className="px-8 py-6 w-48">
                                                    <a 
                                                        href={t.reels?.instagram_url} 
                                                        target="_blank" 
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-900 hover:bg-neutral-200 dark:hover:bg-neutral-800 text-emerald-600 dark:text-emerald-400 font-medium text-xs transition-colors"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                        </svg>
                                                        Source Media
                                                    </a>
                                                    <div className="mt-3 flex items-center gap-3 text-xs font-mono text-neutral-500">
                                                        <span>{t.word_count || 0} words</span>
                                                        <span className="w-1 h-1 rounded-full bg-neutral-300 dark:bg-neutral-700"></span>
                                                        <span className="uppercase">{t.language_detected || "N/A"}</span>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6 max-w-md">
                                                    <div className="bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-xl p-4">
                                                        <p className="text-neutral-700 dark:text-neutral-300 text-sm leading-relaxed line-clamp-3">
                                                            {t.plain_text || <span className="text-neutral-400 italic">No audio/speech text detected in this media file</span>}
                                                        </p>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6 text-center">
                                                    <span className={`inline-flex px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full border ${
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
            </div>
        </div>
    )
}
