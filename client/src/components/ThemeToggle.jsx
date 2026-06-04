import React, { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    // Initial check
    const root = window.document.documentElement;
    const isDarkTheme = root.classList.contains("dark");
    setIsDark(isDarkTheme);
  }, []);

  const toggleTheme = () => {
    const root = window.document.documentElement;
    if (isDark) {
      root.classList.remove("dark");
      root.style.backgroundColor = "#ffffff";
      localStorage.setItem("theme", "light");
      setIsDark(false);
    } else {
      root.classList.add("dark");
      root.style.backgroundColor = "#0a0a0a";
      localStorage.setItem("theme", "dark");
      setIsDark(true);
    }
  };

  return (
    <button
      onClick={toggleTheme}
      className="group p-2 border border-neutral-200 dark:border-neutral-850 hover:border-neutral-300 dark:hover:border-neutral-700/80 rounded-[4px] bg-white dark:bg-neutral-950/40 hover:bg-neutral-50 dark:hover:bg-neutral-900/60 shadow-xs transition-all duration-300 flex items-center justify-center"
      aria-label="Toggle Theme"
      type="button"
    >
      <div className="relative w-4 h-4 flex items-center justify-center transition-transform duration-500 group-hover:rotate-[45deg]">
        {isDark ? (
          // Premium Sun Icon (Aesthetic dot-rays + glowing center)
          <svg className="w-4.5 h-4.5 text-emerald-400 drop-shadow-[0_0_5px_rgba(52,211,153,0.45)] transition-all duration-300" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="4" fill="currentColor" fillOpacity="0.12" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
          </svg>
        ) : (
          // Premium Moon Icon (Aesthetic crescent + twinkling star)
          <svg className="w-4.5 h-4.5 text-neutral-600 hover:text-neutral-800 transition-all duration-300" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" fill="currentColor" fillOpacity="0.08" />
            <path d="M19 3v3M17.5 4.5h3" strokeWidth="1.5" />
          </svg>
        )}
      </div>
    </button>
  );
}
