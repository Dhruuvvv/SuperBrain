import { useState } from "react"
import { supabase } from "../utils/supabaseClient"
import ThemeToggle from "../components/ThemeToggle"

export default function Register() {
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [fullName, setFullName] = useState("")
    const [username, setUsername] = useState("")
    const [msg, setMsg] = useState("")
    const [loading, setLoading] = useState(false)

    const handleRegister = async (e) => {
        if (e) e.preventDefault();
        
        if (!fullName || !username || !email || !password) {
            setMsg("❌ Badha fields fill karo!")
            return
        }

        setLoading(true)
        setMsg("")

        try {
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    emailRedirectTo: null,
                    data: {
                        full_name: fullName,
                        username: username,
                    }
                }
            })

            if (authError) {
                setMsg("❌ Auth Error: " + authError.message)
                return
            }

            const userId = authData.user?.id

            if (!userId) {
                setMsg("❌ User ID nahi malyo. Fari try karo.")
                return
            }

            const { error: profileError } = await supabase
                .from("profiles")
                .upsert({
                    id: userId,
                    full_name: fullName,
                    username: username,
                    email: email,
                })

            if (profileError) {
                setMsg("❌ Profile Error: " + profileError.message)
                return
            }

            setMsg("✅ Registration successful! Login karo.")
            setEmail("")
            setPassword("")
            setFullName("")
            setUsername("")

        } catch (err) {
            setMsg("❌ Error: " + err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-[#0a0a0a] transition-colors duration-200 px-4">
            
            {/* Absolute positioning for Theme Toggle */}
            <div className="absolute top-6 right-6">
                <ThemeToggle />
            </div>

            <div className="max-w-md w-full bg-white dark:bg-[#0d0d0d] border border-neutral-200 dark:border-[#181818] p-8 rounded-[3px] shadow-sm transition-colors duration-200">
                
                {/* Header */}
                <div className="mb-6">
                    <span className="text-[10px] font-mono tracking-widest uppercase text-emerald-500 dark:text-emerald-400">Join SuperBrain</span>
                    <h2 className="text-xl font-bold font-mono tracking-tight text-neutral-900 dark:text-neutral-100 mt-1">
                      👤 Create Account
                    </h2>
                </div>

                <form onSubmit={handleRegister} className="space-y-4">
                    <div>
                        <label className="block text-[10px] font-mono uppercase tracking-wider text-neutral-500 mb-1.5">
                            Full Name
                        </label>
                        <input
                            placeholder="John Doe"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            className="w-full px-3 py-2.5 text-xs bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#222] focus:border-neutral-500 focus:outline-none rounded-[3px] text-neutral-900 dark:text-neutral-100 transition-colors"
                            disabled={loading}
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-[10px] font-mono uppercase tracking-wider text-neutral-500 mb-1.5">
                            Username
                        </label>
                        <input
                            placeholder="johndoe"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full px-3 py-2.5 text-xs bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#222] focus:border-neutral-500 focus:outline-none rounded-[3px] text-neutral-900 dark:text-neutral-100 transition-colors"
                            disabled={loading}
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-[10px] font-mono uppercase tracking-wider text-neutral-500 mb-1.5">
                            Email Address
                        </label>
                        <input
                            type="email"
                            placeholder="name@domain.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-3 py-2.5 text-xs bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#222] focus:border-neutral-500 focus:outline-none rounded-[3px] text-neutral-900 dark:text-neutral-100 transition-colors"
                            disabled={loading}
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-[10px] font-mono uppercase tracking-wider text-neutral-500 mb-1.5">
                            Password
                        </label>
                        <input
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-3 py-2.5 text-xs bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#222] focus:border-neutral-500 focus:outline-none rounded-[3px] text-neutral-900 dark:text-neutral-100 transition-colors"
                            disabled={loading}
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 bg-neutral-900 dark:bg-emerald-500 hover:bg-neutral-800 dark:hover:bg-emerald-400 text-white dark:text-black font-mono font-bold text-xs uppercase tracking-wider rounded-[3px] transition-colors duration-200 disabled:opacity-50 mt-2"
                    >
                        {loading ? "Registering..." : "Submit Registration"}
                    </button>
                </form>

                {/* Notifications */}
                {msg && (
                    <div className={`mt-4 px-4 py-3 rounded-[3px] text-xs font-mono border ${
                        msg.includes("✅") 
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" 
                            : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                    }`}>
                        {msg}
                    </div>
                )}

                {/* Footer and Info */}
                <div className="mt-6 pt-6 border-t border-neutral-150 dark:border-[#181818] text-center">
                    <p className="text-xs text-neutral-500">
                        Already have an account?{" "}
                        <a href="/login" className="text-neutral-900 dark:text-emerald-400 hover:underline font-mono">
                            Login here
                        </a>
                    </p>
                </div>
            </div>
        </div>
    )
}
