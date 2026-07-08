import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../utils/supabaseClient";

export default function AuthCallback() {
    const navigate = useNavigate();

    useEffect(() => {
        async function handleCallback() {
            try {
                // 1. Process query params for PKCE flow (if code exchange is needed)
                const queryParams = new URLSearchParams(window.location.search);
                const code = queryParams.get("code");

                if (code) {
                    const { error } = await supabase.auth.exchangeCodeForSession(code);
                    if (error) throw error;
                }

                // 2. Check current session status and metadata
                const { data: { session } } = await supabase.auth.getSession();
                
                // Get URL hash to check for implicit recovery flow (e.g. forgot password redirect)
                const hashParams = new URLSearchParams(window.location.hash.substring(1));
                const type = hashParams.get("type");

                if (type === "recovery" || window.location.hash.includes("type=recovery")) {
                    // Redirect to reset password page
                    navigate("/reset-password");
                } else if (session) {
                    // Navigate to dashboard if authenticated successfully
                    navigate("/dashboard");
                } else {
                    // Fallback to login
                    navigate("/login");
                }
            } catch (err) {
                console.error("Auth callback error:", err.message);
                navigate("/login");
            }
        }

        handleCallback();
    }, [navigate]);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-neutral-50 dark:bg-[#050505] text-neutral-900 dark:text-neutral-100">
            <div className="relative w-16 h-16 flex items-center justify-center mb-4">
                <div className="absolute inset-0 rounded-full border-2 border-emerald-500/20" />
                <div className="absolute inset-0 rounded-full border-2 border-t-emerald-500 animate-spin" />
            </div>
            <p className="text-sm font-mono text-neutral-500 uppercase tracking-widest animate-pulse">
                Authorizing session...
            </p>
        </div>
    );
}
