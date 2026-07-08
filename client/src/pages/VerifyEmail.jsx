import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../utils/supabaseClient";
import { API_URL } from "../utils/api";
import axios from "axios";
import { Brain, ArrowLeft } from "lucide-react";
import ThemeToggle from "../components/ThemeToggle";

export default function VerifyEmail() {
    const [code, setCode] = useState("");
    const [email, setEmail] = useState("");
    const [msg, setMsg] = useState("");
    const [loading, setLoading] = useState(false);
    const [resendLoading, setResendLoading] = useState(false);
    const [resendTimer, setResendTimer] = useState(0);
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        // Extract email from query param or state
        const queryParams = new URLSearchParams(location.search);
        const emailParam = queryParams.get("email") || location.state?.email || "";
        if (!emailParam) {
            setMsg("❌ Error: No email address provided. Please return to registration.");
        } else {
            setEmail(emailParam);
        }
    }, [location]);

    useEffect(() => {
        let interval;
        if (resendTimer > 0) {
            interval = setInterval(() => {
                setResendTimer((prev) => prev - 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [resendTimer]);

    const handleVerify = async (e) => {
        if (e) e.preventDefault();
        if (!code || code.length !== 6) {
            setMsg("❌ Please enter a valid 6-digit verification code.");
            return;
        }

        setLoading(true);
        setMsg("");

        try {
            // Verify OTP via Supabase
            const { error } = await supabase.auth.verifyOtp({
                email,
                token: code,
                type: "signup",
            });

            if (error) throw error;

            setMsg("✅ Email verified successfully! Redirecting...");
            setTimeout(() => {
                navigate("/dashboard");
            }, 1500);
        } catch (err) {
            setMsg("❌ Verification Error: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        if (resendTimer > 0) return;
        setResendLoading(true);
        setMsg("");

        try {
            const response = await axios.post(`${API_URL}/api/auth/resend-verification`, { email });
            setMsg("✅ " + response.data.message);
            setResendTimer(60); // Start 60-second rate limit timer
        } catch (err) {
            const errMsg = err.response?.data?.error || err.message;
            setMsg("❌ Resend Error: " + errMsg);
        } finally {
            setResendLoading(false);
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
                            Verify your email
                        </h2>
                        <p className="text-neutral-500 dark:text-neutral-400 text-sm max-w-xs">
                            We've sent a 6-digit confirmation code to <span className="font-medium text-emerald-600 dark:text-emerald-400">{email}</span>.
                        </p>
                    </div>

                    <form className="flex flex-col gap-4" onSubmit={handleVerify} noValidate>
                        <div>
                            <label htmlFor="code" className="block text-sm font-medium mb-2 text-neutral-700 dark:text-neutral-300">
                                Verification Code
                            </label>
                            <input
                                type="text"
                                id="code"
                                maxLength={6}
                                placeholder="123456"
                                className="text-center font-mono tracking-widest text-lg w-full py-3 px-4 border rounded-xl focus:outline-none focus:ring-1 bg-white dark:bg-[#111] text-black dark:text-white border-neutral-200 dark:border-white/10 focus:border-emerald-500 focus:ring-emerald-500 dark:focus:border-emerald-500"
                                value={code}
                                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                                disabled={loading}
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
                            disabled={loading || !email}
                            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-medium py-3 px-4 rounded-xl transition-colors mt-2 shadow-sm disabled:opacity-50"
                        >
                            {loading ? "Verifying..." : "Verify & Continue"}
                        </button>

                        <div className="flex flex-col items-center gap-4 mt-6 text-sm">
                            <button
                                type="button"
                                onClick={handleResend}
                                disabled={resendLoading || resendTimer > 0 || !email}
                                className="text-emerald-600 dark:text-emerald-400 font-medium hover:underline disabled:opacity-50 disabled:no-underline"
                            >
                                {resendTimer > 0 
                                    ? `Resend code in ${resendTimer}s` 
                                    : resendLoading ? "Resending..." : "Resend Verification Code"}
                            </button>

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
