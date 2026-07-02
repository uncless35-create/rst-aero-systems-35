import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Оптимизированные изображения кешируются надолго (31 день) — не перекачиваются каждый раз
    minimumCacheTTL: 2678400,
    remotePatterns: [
      // Плейсхолдеры для сида (dev)
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "fastly.picsum.photos" },
      // Supabase Storage (прод) — поддомен подставится автоматически
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
  async headers() {
    return [
      {
        // Фото товаров из public/products — неизменяемые, кешируем на год
        source: "/products/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

export default nextConfig;
