import { useState } from "react";
import { supabase } from "../utils/supabaseClient";
import { useNavigate } from "react-router-dom";
import ThemeToggle from "../components/ThemeToggle";
import { Brain } from "lucide-react";
import { AuroraBars } from "../components/ui/aurora-bars";

export default function Login({ setRole, setUsername }) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [emailError, setEmailError] = useState("");
    const [passwordError, setPasswordError] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const validateEmail = (value) => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    };

    const validatePassword = (value) => {
        return value.length > 0;
    };

    const handleLogin = async (e) => {
        if (e) e.preventDefault();

        let valid = true;
        if (!validateEmail(email)) {
            setEmailError("Please enter a valid email address.");
            valid = false;
        } else {
            setEmailError("");
        }

        if (!validatePassword(password)) {
            setPasswordError("Please enter your password.");
            valid = false;
        } else {
            setPasswordError("");
        }

        if (!valid) return;

        setLoading(true);

        try {
            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (authError) {
                alert("❌ Login Error: " + authError.message);
                setLoading(false);
                return;
            }

            let { data: profileData } = await supabase
                .from("profiles")
                .select("username, full_name")
                .eq("id", authData.user.id)
                .maybeSingle();

            if (!profileData) {
                const fallbackUsername = email.split("@")[0];
                const { data: newProfile, error: insertError } = await supabase
                    .from("profiles")
                    .upsert({
                        id: authData.user.id,
                        full_name: authData.user.user_metadata?.full_name || fallbackUsername,
                        username: authData.user.user_metadata?.username || fallbackUsername,
                        email: email
                    })
                    .select("username, full_name")
                    .maybeSingle();

                if (!insertError && newProfile) {
                    profileData = newProfile;
                }
            }

            // Determine role based on email
            const adminEmails = ["admin@gmail.com", "admin@superbrain.com", "owner@superbrain.com"];
            const isAdmin = adminEmails.includes(authData.user.email);

            if (isAdmin) {
                setRole("admin");
                setUsername("Admin");
                navigate("/admin/users");
            } else {
                setRole("user");
                setUsername(profileData?.username || profileData?.full_name || email);
                navigate("/dashboard");
            }

        } catch (err) {
            alert("Login error: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        setLoading(true);
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${window.location.origin}/dashboard`
                }
            });
            if (error) throw error;
        } catch (err) {
            alert("Google login error: " + err.message);
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-[#050505] transition-colors duration-500 p-4 lg:p-8 relative overflow-hidden">
            {/* Absolute positioning for Theme Toggle in Login */}
            <div className="absolute top-6 right-6 z-50">
                <ThemeToggle />
            </div>

            {/* Outer Shell (Double-Bezel Architecture as requested) */}
            <div className="relative w-full max-w-5xl mx-auto p-2 bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.05] dark:border-white/[0.05] rounded-[2.5rem] shadow-sm">

                {/* Inner Split-Screen Core */}
                <div className="relative w-full bg-white dark:bg-[#0A0A0A] border border-white/20 dark:border-white/10 shadow-xl rounded-[calc(2.5rem-8px)] overflow-hidden flex flex-col md:flex-row z-10">

                    {/* Visual Left Side */}
                    <div className="w-full h-64 md:h-auto md:w-1/2 relative bg-black overflow-hidden flex flex-col justify-between p-8 md:p-12 text-white rounded-t-[calc(2.5rem-8px)] md:rounded-tr-none md:rounded-l-[calc(2.5rem-8px)]">
                        <h1 className="text-3xl md:text-4xl lg:text-5xl font-medium leading-tight z-10 tracking-tight relative mb-8">
                            The intelligent neural core for your learning.
                        </h1>

                        <div className="absolute inset-0 z-0">
                            <AuroraBars
                                barCount={7}
                                // colors={["#ffffff", "#6ee7b7", "#10b981", "#047857", "#00000000"]}
                                colors={["#d1fae5", "#6ee7b7", "#10b981", "#065f46", "#00000000"]}
                                // colors={["#fce4ec", "#f48fb1", "#e91e8c", "#880e4f", "#00000000"]}
                                background="transparent"
                                gap={0}
                                speed={1}
                            />
                        </div>

                        {/* Protect text legibility at the top */}
                        <div className="absolute inset-0 z-0 bg-gradient-to-b from-black/80 via-transparent to-transparent opacity-100"></div>

                        {/* Soft white base glow to enhance the bottom */}
                        <div className="absolute bottom-0 left-0 right-0 h-32 z-0 bg-gradient-to-t from-white/20 to-transparent"></div>

                        {/* Orange/Brand Orbs */}
                        <div className="w-[15rem] h-[15rem] bg-emerald-500 absolute z-0 rounded-full bottom-0 left-[-5rem] blur-3xl opacity-30"></div>
                        <div className="w-[10rem] h-[10rem] bg-emerald-300 absolute z-0 rounded-full bottom-10 right-[-2rem] blur-3xl opacity-20"></div>
                    </div>

                    {/* Form Right Side */}
                    <div className="w-full md:w-1/2 flex flex-col p-8 md:p-12 lg:px-16 bg-white dark:bg-[#0A0A0A] z-10">
                        <div className="flex flex-col items-start mb-8">
                            <div className="text-emerald-500 mb-6 bg-emerald-50 dark:bg-emerald-500/10 p-3 rounded-2xl">
                                <Brain className="h-8 w-8" />
                            </div>
                            <h2 className="text-3xl font-medium mb-2 tracking-tight text-neutral-900 dark:text-white">
                                Welcome back
                            </h2>
                            <p className="text-left text-neutral-500 dark:text-neutral-400">
                                Sign in to your SuperBrain portal
                            </p>
                        </div>

                        <form className="flex flex-col gap-4" onSubmit={handleLogin} noValidate>
                            <div>
                                <label htmlFor="email" className="block text-sm font-medium mb-2 text-neutral-700 dark:text-neutral-300">
                                    Your email
                                </label>
                                <input
                                    type="email"
                                    id="email"
                                    placeholder="name@domain.com"
                                    className={`text-sm w-full py-3 px-4 border rounded-xl focus:outline-none focus:ring-1 bg-white dark:bg-[#111] text-black dark:text-white transition-colors ${emailError ? "border-red-500 focus:ring-red-500" : "border-neutral-200 dark:border-white/10 focus:border-emerald-500 focus:ring-emerald-500 dark:focus:border-emerald-500"
                                        }`}
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    disabled={loading}
                                    aria-invalid={!!emailError}
                                />
                                {emailError && (
                                    <p className="text-red-500 text-xs mt-1.5">{emailError}</p>
                                )}
                            </div>

                            <div>
                                <label htmlFor="password" className="block text-sm font-medium mb-2 text-neutral-700 dark:text-neutral-300">
                                    Password
                                </label>
                                <input
                                    type="password"
                                    id="password"
                                    placeholder="••••••••"
                                    className={`text-sm w-full py-3 px-4 border rounded-xl focus:outline-none focus:ring-1 bg-white dark:bg-[#111] text-black dark:text-white transition-colors ${passwordError ? "border-red-500 focus:ring-red-500" : "border-neutral-200 dark:border-white/10 focus:border-emerald-500 focus:ring-emerald-500 dark:focus:border-emerald-500"
                                        }`}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    disabled={loading}
                                    aria-invalid={!!passwordError}
                                />
                                {passwordError && (
                                    <p className="text-red-500 text-xs mt-1.5">{passwordError}</p>
                                )}
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-medium py-3 px-4 rounded-xl transition-colors mt-2 shadow-sm disabled:opacity-50"
                            >
                                {loading ? "Verifying..." : "Sign in to account"}
                            </button>

                            <div className="my-4 flex items-center gap-3">
                                <div className="flex-1 h-px bg-neutral-200 dark:bg-white/10" />
                                <span className="text-xs text-neutral-400">Or continue with</span>
                                <div className="flex-1 h-px bg-neutral-200 dark:bg-white/10" />
                            </div>

                            <button
                                type="button"
                                onClick={handleGoogleLogin}
                                disabled={loading}
                                className="w-full py-3 flex items-center justify-center gap-3 bg-white dark:bg-[#111] border border-neutral-200 dark:border-white/10 hover:bg-neutral-50 dark:hover:bg-white/5 text-neutral-700 dark:text-neutral-300 font-medium text-sm rounded-xl transition-colors shadow-sm disabled:opacity-50"
                            >
                                <svg className="size-4" viewBox="0 0 24 24">
                                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                </svg>
                                Google
                            </button>

                            <div className="text-center text-neutral-500 dark:text-neutral-400 text-sm mt-4">
                                Don't have an account?{" "}
                                <a href="/register" className="text-neutral-900 dark:text-white font-medium hover:underline underline-offset-4">
                                    Create one
                                </a>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
