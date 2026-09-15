"use client";

import { useEffect } from "react";

export function PreventZoom() {
  useEffect(() => {
    // 1. Disable multi-touch pinch zoom on mobile devices
    function handleTouchStart(e: TouchEvent) {
      if (e.touches.length > 1 && e.cancelable) {
        e.preventDefault();
      }
    }

    // 2. Disable Safari gesture zoom (pinch gesture)
    function handleGestureStart(e: Event) {
      if (e.cancelable) {
        e.preventDefault();
      }
    }

    function handleGestureChange(e: Event) {
      if (e.cancelable) {
        e.preventDefault();
      }
    }

    // 3. Disable double-tap zoom
    let lastTouchTime = 0;
    function handleTouchEnd(e: TouchEvent) {
      const now = Date.now();
      if (now - lastTouchTime <= 300) {
        const target = e.target as HTMLElement | null;
        if (target && !["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) {
          if (e.cancelable) {
            e.preventDefault();
          }
        }
      }
      lastTouchTime = now;
    }

    document.addEventListener("touchstart", handleTouchStart, { passive: false });
    document.addEventListener("gesturestart", handleGestureStart, { passive: false });
    document.addEventListener("gesturechange", handleGestureChange, { passive: false });
    document.addEventListener("touchend", handleTouchEnd, { passive: false });

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("gesturestart", handleGestureStart);
      document.removeEventListener("gesturechange", handleGestureChange);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, []);

  return null;
}
