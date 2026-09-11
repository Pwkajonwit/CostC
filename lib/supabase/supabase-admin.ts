import { createClient } from "@supabase/supabase-js";

// Suppress Node 20 deprecation warning from @supabase/supabase-js
if (typeof process !== "undefined" && process.env) {
  process.env.SUPABASE_DISABLE_NODE_WARNING = "1";
}

if (typeof console !== "undefined" && console.warn) {
  const _origWarn = console.warn;
  console.warn = function (...args: any[]) {
    const msg = String(args[0] || "");
    if (
      msg.includes("Node.js 20 and below are deprecated") ||
      msg.includes("deprecated and will no longer be supported")
    ) {
      return;
    }
    _origWarn.apply(console, args);
  };
}

// Polyfill WebSocket for environments where WebSocket is missing
if (typeof globalThis.WebSocket === "undefined") {
  (globalThis as any).WebSocket = class DummyWebSocket {};
}

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  "https://placeholder.supabase.co";

const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "placeholder-service-key";

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
