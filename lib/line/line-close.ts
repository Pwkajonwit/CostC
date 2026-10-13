"use client";

/**
 * Utility to close the current window / webview and return directly to LINE.
 * Works across:
 * 1. LINE LIFF (liff.closeWindow())
 * 2. LINE In-App Browser (window.close() & line://app/close)
 * 3. Popups & standard browsers (window.close() fallback to back/home)
 */
export async function closeToLine(fallbackUrl?: string): Promise<void> {
  if (typeof window === "undefined") return;

  let closedSuccessfully = false;

  // 1. First priority: Try official LINE LIFF SDK
  try {
    let liff: any = (window as any).liff;

    if (!liff) {
      try {
        // @ts-ignore
        const liffModule = await import("@line/liff");
        liff = liffModule.default || liffModule;
      } catch (importErr) {
        // Fallback: check window again
        liff = (window as any).liff;
      }
    }

    if (liff) {
      // If already initialized and inside LINE client
      if (typeof liff.isInClient === "function" && liff.isInClient()) {
        try {
          liff.closeWindow();
          closedSuccessfully = true;
          return;
        } catch (e) {
          console.warn("liff.closeWindow error:", e);
        }
      }

      // If not yet initialized, try initializing with default or env LIFF ID
      const activeLiffId = process.env.NEXT_PUBLIC_LINE_LIFF_ID || "";

      if (typeof liff.init === "function" && activeLiffId) {
        try {
          await liff.init({ liffId: activeLiffId });
          if (typeof liff.isInClient === "function" && liff.isInClient()) {
            liff.closeWindow();
            closedSuccessfully = true;
            return;
          }
        } catch (initErr) {
          // If init throws because already initialized, try closing anyway
          try {
            liff.closeWindow();
            closedSuccessfully = true;
            return;
          } catch {}
        }
      }
    }
  } catch (liffErr) {
    console.warn("LIFF close attempt failed:", liffErr);
  }

  // 2. Second priority: Standard window.close()
  try {
    window.close();
  } catch (e) {}

  // 3. Third priority: If inside LINE in-app browser (User Agent check)
  const ua = (navigator.userAgent || "").toLowerCase();
  const isLine = ua.includes("line");

  if (isLine) {
    try {
      // In LINE browser, line://app/close or closing the webview
      window.location.href = "line://app/close";
      closedSuccessfully = true;
      return;
    } catch (e) {}

    // Fallback: try navigating backward in history to return to chat
    setTimeout(() => {
      try {
        if (window.history.length > 1) {
          window.history.back();
        }
      } catch {}
    }, 150);
    return;
  }

  // 4. Fallback if outside LINE (e.g. desktop Chrome / Safari)
  // Browser won't allow window.close() for tabs not opened by script
  setTimeout(() => {
    if (!closedSuccessfully) {
      if (fallbackUrl) {
        window.location.href = fallbackUrl;
      } else if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = "/";
      }
    }
  }, 250);
}
