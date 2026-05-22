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
            <div className="min-h-screen bg-neutral-50 dark:bg-[#0a0a0a] text-neutral-900 dark:text-neutral-100 flex flex-col items-center justify-center gap-3">
                <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                <p className="text-xs font-mono text-neutral-500">Querying user accounts...</p>
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
                      👥 Registered Profiles ({users.length})
                    </h2>
                </div>
                
                <div className="flex items-center gap-3">
                    <button 
                        onClick={fetchUsers}
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
            <div className="max-w-6xl mx-auto bg-white dark:bg-[#0d0d0d] border border-neutral-200 dark:border-[#181818] rounded-[3px] overflow-hidden shadow-sm">
                {users.length === 0 ? (
                    <div className="p-12 text-center text-xs font-mono text-neutral-500">
                        No user profiles exist in the system.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left text-xs">
                            <thead>
                                <tr className="bg-neutral-50 dark:bg-[#111] border-b border-neutral-200 dark:border-[#181818] text-neutral-500 uppercase tracking-wider font-mono">
                                    <th className="px-6 py-4 font-bold">Full Name</th>
                                    <th className="px-6 py-4 font-bold">Username</th>
                                    <th className="px-6 py-4 font-bold">Unique ID</th>
                                    <th className="px-6 py-4 font-bold">Registration Date</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-200 dark:divide-[#181818]">
                                {users.map((u) => (
                                    <tr key={u.id} className="hover:bg-neutral-50 dark:hover:bg-[#141414] transition-colors duration-150">
                                        <td className="px-6 py-4 text-neutral-800 dark:text-neutral-200 font-medium">
                                            {u.full_name || "N/A"}
                                        </td>
                                        <td className="px-6 py-4 font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                                            @{u.username}
                                        </td>
                                        <td className="px-6 py-4 font-mono text-neutral-400 dark:text-neutral-500">
                                            {u.id}
                                        </td>
                                        <td className="px-6 py-4 text-neutral-600 dark:text-neutral-400 font-mono">
                                            {new Date(u.created_at).toLocaleString()}
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
