import React, { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    // Initial check
    const root = window.document.documentElement;
    const isDarkTheme = root.classList.contains("dark");
    setIsDark(isDarkTheme);
  }, []);

  const toggleTheme = (e) => {
    const x = e?.clientX ?? window.innerWidth / 2;
    const y = e?.clientY ?? window.innerHeight / 2;
    document.documentElement.style.setProperty('--x', `${x}px`);
    document.documentElement.style.setProperty('--y', `${y}px`);
    const applyThemeChange = () => {
      const root = window.document.documentElement;
      if (isDark) {
        root.classList.remove("dark");
        root.style.backgroundColor = "#FAFAF8";
        localStorage.setItem("theme", "light");
        setIsDark(false);
      } else {
        root.classList.add("dark");
        root.style.backgroundColor = "#0A0B0D";
        localStorage.setItem("theme", "dark");
        setIsDark(true);
      }
    };

    if (document.startViewTransition) {
      document.startViewTransition(applyThemeChange);
    } else {
      applyThemeChange();
    }
  };

  return (
    <button
      onClick={toggleTheme}
      className="group relative w-10 h-10 rounded-full border border-black/5 dark:border-white/5 bg-transparent hover:bg-black/5 dark:hover:bg-white/5 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.92] flex items-center justify-center overflow-hidden"
      aria-label="Toggle Theme"
      type="button"
    >
      <div className="relative w-full h-full flex items-center justify-center">
        {isDark ? (
          // Ultra-minimal Sun
          <svg className="w-[18px] h-[18px] text-[#F2F2F0] transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:rotate-[90deg] group-hover:scale-110" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 3v1M12 20v1M4.22 4.22l.71.71M19.07 19.07l.71.71M3 12h1M20 12h1M4.22 19.07l.71-.71M19.07 4.22l.71-.71" />
          </svg>
        ) : (
          // Ultra-minimal Moon
          <svg className="w-[18px] h-[18px] text-[#111111] transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:-rotate-[15deg] group-hover:scale-110" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        )}
      </div>
    </button>
  );
}
