import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Оптимизированные изображения кешируются надолго (31 день) — не перекачиваются каждый раз
    minimumCacheTTL: 2678400,
    remotePatterns: [
      // Supabase Storage (загрузка фото из админки)
      { protocol: "https", hostname: "*.supabase.co" },
      // Официальное фото TX15 MAX, пока для фактической партии нет собственного снимка.
      { protocol: "https", hostname: "radiomasterrc.com", pathname: "/cdn/shop/files/**" },
    ],
  },
  async headers() {
    return [
      {
        // Security-заголовки для всех страниц
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Strict-Transport-Security", value: "max-age=31536000" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
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
