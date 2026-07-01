import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Плейсхолдеры для сида (dev)
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "fastly.picsum.photos" },
      // Supabase Storage (прод) — поддомен подставится автоматически
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
};

export default nextConfig;
