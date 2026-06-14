import { useEffect, useState } from "react"
import { supabase } from "../utils/supabaseClient"
import ThemeToggle from "../components/ThemeToggle"

export default function Users() {
    const [users, setUsers] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState("")

    useEffect(() => {
        fetchUsers()
    }, [])

    async function fetchUsers() {
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from("profiles")
                .select("*")
                .order("created_at", { ascending: false })

            if (error) throw error
            setUsers(data || [])
        } catch (err) {
            console.error("Users fetch error:", err)
            setError("Users load nahi thai sake: " + err.message)
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
                        <p className="text-[10px] font-sans text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.2em]">Authenticating users</p>
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
                            Registered Profiles
                            <span className="ml-3 text-2xl text-neutral-400 dark:text-neutral-600 font-sans not-italic font-light tracking-tight">({users.length})</span>
                        </h2>
                    </div>
                    
                    <button 
                        onClick={fetchUsers}
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
                        
                        {users.length === 0 ? (
                            <div className="p-20 text-center flex flex-col items-center justify-center">
                                <div className="w-16 h-16 mb-4 rounded-full bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center text-2xl">👥</div>
                                <h3 className="text-lg font-medium text-neutral-900 dark:text-white">No users found</h3>
                                <p className="text-sm text-neutral-500 mt-1">The system is currently empty.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead>
                                        <tr className="border-b border-neutral-200 dark:border-white/10 bg-neutral-50/50 dark:bg-white/[0.02]">
                                            <th className="px-8 py-5 font-medium text-neutral-500 dark:text-neutral-400">Profile</th>
                                            <th className="px-8 py-5 font-medium text-neutral-500 dark:text-neutral-400">Unique Identifier</th>
                                            <th className="px-8 py-5 font-medium text-neutral-500 dark:text-neutral-400 text-right">Registration Date</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-neutral-200 dark:divide-white/5">
                                        {users.map((u) => (
                                            <tr key={u.id} className="group hover:bg-neutral-50/50 dark:hover:bg-white/[0.02] transition-colors duration-300">
                                                <td className="px-8 py-6">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-neutral-200 to-neutral-100 dark:from-neutral-800 dark:to-neutral-900 flex items-center justify-center font-medium text-neutral-600 dark:text-neutral-300 border border-black/5 dark:border-white/10 shadow-inner">
                                                            {u.full_name ? u.full_name.charAt(0).toUpperCase() : u.username.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <div className="font-medium text-lg text-neutral-900 dark:text-white flex items-center gap-2">
                                                                {u.full_name || "Anonymous"}
                                                                {u.email === "owner@superbrain.com" && (
                                                                    <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-500 text-[10px] font-bold uppercase tracking-wider">Owner</span>
                                                                )}
                                                            </div>
                                                            <div className="text-neutral-500 text-xs mt-0.5">@{u.username}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6">
                                                    <div className="inline-flex items-center px-3 py-1 rounded-md bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-white/5 text-neutral-600 dark:text-neutral-400 font-mono text-[11px]">
                                                        {u.id}
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6 text-right text-neutral-500 text-sm">
                                                    {new Date(u.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
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
