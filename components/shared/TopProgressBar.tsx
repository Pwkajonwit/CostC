"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function startTopProgress() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("costlab-nav-start"));
  }
}

export function stopTopProgress() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("costlab-nav-end"));
  }
}

function ProgressBarInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const resetTimerRef = useRef<NodeJS.Timeout | null>(null);

  const startProgress = () => {
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
    setVisible(true);
    setProgress(20);

    if (timerRef.current) clearInterval(timerRef.current);

    // Smooth trickling progress up to 90%
    timerRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev < 50) return prev + Math.random() * 12 + 6;
        if (prev < 75) return prev + Math.random() * 8 + 3;
        if (prev < 88) return prev + Math.random() * 3 + 1;
        return prev;
      });
    }, 180);
  };

  const completeProgress = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setProgress(100);

    resetTimerRef.current = setTimeout(() => {
      setVisible(false);
      resetTimerRef.current = setTimeout(() => {
        setProgress(0);
      }, 250);
    }, 200);
  };

  // Complete progress on pathname or searchParams change
  useEffect(() => {
    completeProgress();
  }, [pathname, searchParams]);

  // Global navigation listeners
  useEffect(() => {
    const handleNavStart = () => startProgress();
    const handleNavEnd = () => completeProgress();

    window.addEventListener("costlab-nav-start", handleNavStart);
    window.addEventListener("costlab-nav-end", handleNavEnd);
    window.addEventListener("popstate", handleNavStart);

    // Intercept internal link clicks for instant < 5ms response
    const handleDocumentClick = (e: MouseEvent) => {
      // Don't intercept if modifier keys are pressed (e.g. open in new tab)
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.defaultPrevented) return;

      const target = e.target as HTMLElement | null;
      const anchor = target?.closest("a") as HTMLAnchorElement | null;
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href) return;

      // Ignore hash anchors, external links, mailto, tel, javascript, downloads
      if (
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        href.startsWith("javascript:") ||
        anchor.target === "_blank" ||
        anchor.hasAttribute("download")
      ) {
        return;
      }

      // Check if it's an internal URL
      try {
        const url = new URL(anchor.href, window.location.href);
        const currentUrl = new URL(window.location.href);

        // If same origin and different path/search, start progress immediately
        if (url.origin === currentUrl.origin) {
          if (url.pathname !== currentUrl.pathname || url.search !== currentUrl.search) {
            startProgress();
          }
        }
      } catch (err) {
        // Ignore URL parse errors
      }
    };

    document.addEventListener("click", handleDocumentClick, { capture: true });

    return () => {
      window.removeEventListener("costlab-nav-start", handleNavStart);
      window.removeEventListener("costlab-nav-end", handleNavEnd);
      window.removeEventListener("popstate", handleNavStart);
      document.removeEventListener("click", handleDocumentClick, { capture: true });
      if (timerRef.current) clearInterval(timerRef.current);
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, []);

  if (!visible && progress === 0) return null;

  return (
    <div
      aria-hidden="true"
      className="fixed top-0 left-0 right-0 pointer-events-none z-[99999]"
      style={{
        opacity: visible ? 1 : 0,
        transition: "opacity 200ms ease-out"
      }}
    >
      {/* Top Glowing Progress Bar */}
      <div
        className="h-[3px] bg-gradient-to-r from-emerald-500 via-[#d4f54e] to-lime-400 shadow-sm"
        style={{
          width: `${progress}%`,
          transition: progress === 100 ? "width 150ms ease-out" : "width 220ms ease",
          boxShadow: "0 0 10px rgba(212, 245, 78, 0.9), 0 0 5px rgba(16, 185, 129, 0.8)"
        }}
      />
      {/* Subtle Lead Particle Glowing Flare */}
      {visible && progress > 0 && progress < 100 && (
        <div
          className="absolute top-0 w-24 h-[3px] bg-gradient-to-r from-transparent via-white/80 to-transparent blur-[1px]"
          style={{
            left: `calc(${progress}% - 96px)`,
            transition: "left 220ms ease"
          }}
        />
      )}
    </div>
  );
}

export function TopProgressBar() {
  return (
    <Suspense fallback={null}>
      <ProgressBarInner />
    </Suspense>
  );
}
