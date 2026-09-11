process.env.SUPABASE_DISABLE_NODE_WARNING = "1";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "raw.githubusercontent.com" },
      { protocol: "https", hostname: "profile.line-scdn.net" },
    ],
  },
  experimental: {
    staleTimes: {
      dynamic: 30,
      static: 180
    },
    optimizePackageImports: ["lucide-react", "recharts", "date-fns"]
  }
};

export default nextConfig;
