import { useState } from "react"
import { supabase } from "../utils/supabaseClient"
import { useNavigate } from "react-router-dom"
import ThemeToggle from "../components/ThemeToggle"

export default function Login({ setRole, setUsername }) {
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [loading, setLoading] = useState(false)
    const navigate = useNavigate()

    const handleLogin = async (e) => {
        if (e) e.preventDefault();
        setLoading(true)

        // Admin login
        if (email === "admin@gmail.com" && password === "admin123") {
            setRole("admin")
            setUsername("Admin")
            navigate("/admin/users")
            setLoading(false)
            return
        }

        try {
            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email,
                password,
            })

            if (authError) {
                alert("❌ Login Error: " + authError.message)
                setLoading(false)
                return
            }

            let { data: profileData } = await supabase
                .from("profiles")
                .select("username, full_name")
                .eq("id", authData.user.id)
                .maybeSingle()

            if (!profileData) {
                // Self-healing: profile row is missing, insert it on the fly
                const fallbackUsername = email.split("@")[0]
                const { data: newProfile, error: insertError } = await supabase
                    .from("profiles")
                    .upsert({
                        id: authData.user.id,
                        full_name: authData.user.user_metadata?.full_name || fallbackUsername,
                        username: authData.user.user_metadata?.username || fallbackUsername,
                        email: email
                    })
                    .select("username, full_name")
                    .maybeSingle()
                
                if (!insertError && newProfile) {
                    profileData = newProfile
                }
            }

            setRole("user")
            setUsername(profileData?.username || profileData?.full_name || email)
            navigate("/dashboard")

        } catch (err) {
            alert("Login error: " + err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleKeyDown = (e) => {
        if (e.key === "Enter") {
            handleLogin(e);
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-[#0a0a0a] transition-colors duration-200 px-4">
            
            {/* Absolute positioning for Theme Toggle in Login */}
            <div className="absolute top-6 right-6">
                <ThemeToggle />
            </div>

            <div className="max-w-md w-full bg-white dark:bg-[#0d0d0d] border border-neutral-200 dark:border-[#181818] p-8 rounded-[3px] shadow-sm transition-colors duration-200">
                
                {/* Header */}
                <div className="mb-8">
                    <span className="text-[10px] font-mono tracking-widest uppercase text-emerald-500 dark:text-emerald-400">Secure Access</span>
                    <h2 className="text-xl font-bold font-mono tracking-tight text-neutral-900 dark:text-neutral-100 mt-1">
                      💡 SuperBrain Portal
                    </h2>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label className="block text-[10px] font-mono uppercase tracking-wider text-neutral-500 mb-1.5">
                            Email Address
                        </label>
                        <input
                            type="email"
                            placeholder="name@domain.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            onKeyDown={handleKeyDown}
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
                            onKeyDown={handleKeyDown}
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
                        {loading ? "Verifying..." : "Authenticate"}
                    </button>
                </form>

                {/* Footer and Info */}
                <div className="mt-8 pt-6 border-t border-neutral-150 dark:border-[#181818] space-y-4 text-center">
                    <p className="text-[11px] font-mono text-neutral-450 dark:text-neutral-500 leading-relaxed bg-neutral-50 dark:bg-[#111] p-3 border border-neutral-200 dark:border-[#222] rounded-[2px]">
                        🔑 Admin Credentials:<br/>
                        <span className="text-neutral-600 dark:text-neutral-300">admin@gmail.com</span> / <span className="text-neutral-600 dark:text-neutral-300">admin123</span>
                    </p>
                    <p className="text-xs text-neutral-500">
                        Need an account?{" "}
                        <a href="/register" className="text-neutral-900 dark:text-emerald-400 hover:underline font-mono">
                            Register here
                        </a>
                    </p>
                </div>
            </div>
        </div>
    )
}
