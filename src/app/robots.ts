import type { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Приватные/служебные разделы и страницы без своего содержимого (поиск, избранное, вход) не индексируем
        disallow: [
          "/admin", "/account", "/api", "/checkout", "/cart", "/order",
          "/search", "/favorites", "/login", "/register", "/pereezd.html",
        ],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
