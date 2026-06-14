"use client";
import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Globe, Search, X } from "lucide-react";
import { cn } from "lib/utils";

function extractDomain(input) {
  if (!input.trim()) return null;
  try {
    const raw = input.includes("://") ? input : `https://${input}`;
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./, "");
    if (host.includes(".") && host.split(".").every(Boolean)) return host;
    return null;
  } catch {
    const cleaned = input.trim().replace(/^www\./, "");
    if (cleaned.includes(".") && cleaned.split(".").every(Boolean))
      return cleaned;
    return null;
  }
}

function getFaviconUrl(domain, size = 64) {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${size}`;
}

const FaviconSearch = React.forwardRef((
  {
    value: controlledValue,
    defaultValue = "",
    onChange,
    onSearch,
    placeholder = "Enter a website URL…",
    clearable = true,
    faviconSize = 64,
    debounce = 350,
    className,
    inputClassName,
  },
  ref,
) => {
  const isControlled = controlledValue !== undefined;
  const [internalValue, setInternalValue] = React.useState(defaultValue);
  const value = isControlled ? controlledValue : internalValue;

  const [domain, setDomain] = React.useState(null);
  const [faviconReady, setFaviconReady] = React.useState(false);
  const [faviconError, setFaviconError] = React.useState(false);
  const prevDomainRef = React.useRef(null);

  React.useEffect(() => {
    const id = setTimeout(() => {
      const d = extractDomain(value);
      if (d !== prevDomainRef.current) {
        prevDomainRef.current = d;
        setFaviconReady(false);
        setFaviconError(false);
        setDomain(d);
      }
    }, debounce);
    return () => clearTimeout(id);
  }, [value, debounce]);

  const handleChange = (e) => {
    const v = e.target.value;
    if (!isControlled) setInternalValue(v);
    onChange?.(v);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      onSearch?.(value, domain);
    }
  };

  const handleClear = () => {
    if (!isControlled) setInternalValue("");
    onChange?.("");
    setDomain(null);
    setFaviconReady(false);
    setFaviconError(false);
    prevDomainRef.current = null;
  };

  const showFavicon = domain && faviconReady && !faviconError;

  return (
    <div
      className={cn("relative flex items-center w-full max-w-md group", className)}>
      <div
        className="pointer-events-none absolute left-3.5 flex items-center justify-center size-5">
        <AnimatePresence mode="wait">
          {showFavicon ? (
            <motion.img
              key={`favicon-${domain}`}
              src={getFaviconUrl(domain, faviconSize)}
              alt={domain}
              width={20}
              height={20}
              className="size-5 rounded-sm object-contain"
              initial={{ opacity: 0, scale: 0.5, filter: "blur(4px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, scale: 0.5, filter: "blur(4px)" }}
              transition={{ type: "spring", stiffness: 400, damping: 28 }}
              onLoad={() => setFaviconReady(true)}
              onError={() => setFaviconError(true)} />
          ) : (
            <motion.span
              key="search-icon"
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              transition={{ type: "spring", stiffness: 400, damping: 28 }}
              className="flex items-center justify-center text-muted-foreground">
              {domain && !faviconError ? (
                <Globe className="size-[18px]" />
              ) : (
                <Search className="size-[18px]" />
              )}
            </motion.span>
          )}
        </AnimatePresence>

        {/* preload img to detect load/error before showing the animated favicon */}
        {domain && !faviconReady && !faviconError && (
          <img
            src={getFaviconUrl(domain, faviconSize)}
            alt=""
            className="sr-only absolute"
            onLoad={() => setFaviconReady(true)}
            onError={() => setFaviconError(true)}
            aria-hidden />
        )}
      </div>
      <input
        ref={ref}
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={cn(
          "flex w-full rounded-xl border border-border bg-background",
          "pl-10 pr-10 py-2.5 text-sm text-foreground",
          "placeholder:text-muted-foreground",
          "outline-none ring-offset-background",
          "transition-shadow duration-200",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "hover:border-muted-foreground/50",
          inputClassName
        )} />
      <AnimatePresence>
        {clearable && value.length > 0 && (
          <motion.button
            type="button"
            onClick={handleClear}
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.7 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className={cn(
              "absolute right-3 flex items-center justify-center",
              "size-5 rounded-full text-muted-foreground",
              "hover:text-foreground hover:bg-muted transition-colors"
            )}
            aria-label="Clear input">
            <X className="size-3.5" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
});
FaviconSearch.displayName = "FaviconSearch";

export { FaviconSearch, extractDomain, getFaviconUrl };
