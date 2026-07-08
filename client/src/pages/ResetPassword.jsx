import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../utils/supabaseClient";
import { Brain, Eye, EyeOff } from "lucide-react";
import ThemeToggle from "../components/ThemeToggle";

export default function ResetPassword() {
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [msg, setMsg] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        // Double check if the user is authenticated (which they must be when redirected via reset link)
        async function checkSession() {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                setMsg("❌ Error: Invalid or expired reset link. Please request a new one.");
            }
        }
        checkSession();
    }, []);

    const handleResetPassword = async (e) => {
        if (e) e.preventDefault();
        
        if (!password || !confirmPassword) {
            setMsg("❌ Please fill in all fields.");
            return;
        }

        if (password.length < 8) {
            setMsg("❌ Password must be at least 8 characters long.");
            return;
        }

        if (password !== confirmPassword) {
            setMsg("❌ Passwords do not match.");
            return;
        }

        setLoading(true);
        setMsg("");

        try {
            const { error } = await supabase.auth.updateUser({
                password: password,
            });

            if (error) throw error;

            setMsg("✅ Password updated successfully! Redirecting to login...");
            
            // Log out user session to require fresh sign-in
            await supabase.auth.signOut();
            
            setTimeout(() => {
                navigate("/login");
            }, 2000);
        } catch (err) {
            setMsg("❌ Error: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-[#050505] transition-colors duration-500 p-4 lg:p-8 relative overflow-hidden">
            <div className="absolute top-6 right-6 z-50">
                <ThemeToggle />
            </div>

            <div className="relative w-full max-w-md mx-auto p-2 bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.05] dark:border-white/[0.05] rounded-[2rem] shadow-sm">
                <div className="relative w-full bg-white dark:bg-[#0A0A0A] border border-white/20 dark:border-white/10 shadow-xl rounded-[calc(2rem-8px)] p-8 md:p-10 flex flex-col z-10">
                    
                    <div className="flex flex-col items-center mb-8 text-center">
                        <div className="text-emerald-500 mb-4 bg-emerald-50 dark:bg-emerald-500/10 p-3 rounded-2xl">
                            <Brain className="h-8 w-8" />
                        </div>
                        <h2 className="text-2xl font-semibold mb-2 tracking-tight text-neutral-900 dark:text-white">
                            Set new password
                        </h2>
                        <p className="text-neutral-500 dark:text-neutral-400 text-sm max-w-xs">
                            Create a strong, secure new password for your SuperBrain space.
                        </p>
                    </div>

                    <form className="flex flex-col gap-4" onSubmit={handleResetPassword} noValidate>
                        <div>
                            <label htmlFor="password" className="block text-sm font-medium mb-2 text-neutral-700 dark:text-neutral-300">
                                New Password
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    id="password"
                                    placeholder="••••••••"
                                    className="text-sm w-full py-3 px-4 border rounded-xl focus:outline-none focus:ring-1 bg-white dark:bg-[#111] text-black dark:text-white border-neutral-200 dark:border-white/10 focus:border-emerald-500 focus:ring-emerald-500 dark:focus:border-emerald-500"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    disabled={loading || msg.startsWith("❌ Error: Invalid")}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                                >
                                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                                </button>
                            </div>
                        </div>

                        <div>
                            <label htmlFor="confirmPassword" className="block text-sm font-medium mb-2 text-neutral-700 dark:text-neutral-300">
                                Confirm New Password
                            </label>
                            <input
                                type={showPassword ? "text" : "password"}
                                id="confirmPassword"
                                placeholder="••••••••"
                                className="text-sm w-full py-3 px-4 border rounded-xl focus:outline-none focus:ring-1 bg-white dark:bg-[#111] text-black dark:text-white border-neutral-200 dark:border-white/10 focus:border-emerald-500 focus:ring-emerald-500 dark:focus:border-emerald-500"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                disabled={loading || msg.startsWith("❌ Error: Invalid")}
                            />
                        </div>

                        {msg && (
                            <div className={`text-sm mt-2 p-3 rounded-xl border ${
                                msg.startsWith("✅") 
                                    ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 border-emerald-500/10" 
                                    : "text-rose-600 dark:text-rose-400 bg-rose-500/5 border-rose-500/10"
                            }`}>
                                {msg}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading || msg.startsWith("❌ Error: Invalid")}
                            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-medium py-3 px-4 rounded-xl transition-colors mt-2 shadow-sm disabled:opacity-50"
                        >
                            {loading ? "Updating..." : "Update Password"}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
