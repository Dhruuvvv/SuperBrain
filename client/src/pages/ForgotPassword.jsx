import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../utils/supabaseClient";
import { Brain, ArrowLeft, Mail } from "lucide-react";
import ThemeToggle from "../components/ThemeToggle";

export default function ForgotPassword() {
    const [email, setEmail] = useState("");
    const [msg, setMsg] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleResetRequest = async (e) => {
        if (e) e.preventDefault();
        if (!email) {
            setMsg("❌ Please enter your email address.");
            return;
        }

        setLoading(true);
        setMsg("");

        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/auth/callback`,
            });

            if (error) throw error;

            setMsg("✅ Password reset link has been sent to your email.");
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
                            Reset password
                        </h2>
                        <p className="text-neutral-500 dark:text-neutral-400 text-sm max-w-xs">
                            Enter your email and we'll send you a secure link to reset your password.
                        </p>
                    </div>

                    <form className="flex flex-col gap-4" onSubmit={handleResetRequest} noValidate>
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium mb-2 text-neutral-700 dark:text-neutral-300">
                                Email address
                            </label>
                            <div className="relative">
                                <input
                                    type="email"
                                    id="email"
                                    placeholder="name@domain.com"
                                    className="text-sm w-full py-3 pl-10 pr-4 border rounded-xl focus:outline-none focus:ring-1 bg-white dark:bg-[#111] text-black dark:text-white border-neutral-200 dark:border-white/10 focus:border-emerald-500 focus:ring-emerald-500 dark:focus:border-emerald-500"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    disabled={loading}
                                />
                                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-neutral-400" />
                            </div>
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
                            disabled={loading}
                            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-medium py-3 px-4 rounded-xl transition-colors mt-2 shadow-sm disabled:opacity-50"
                        >
                            {loading ? "Sending..." : "Send Reset Link"}
                        </button>

                        <div className="flex justify-center mt-6 text-sm">
                            <button
                                type="button"
                                onClick={() => navigate("/login")}
                                className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
                            >
                                <ArrowLeft className="size-4" />
                                Back to login
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
