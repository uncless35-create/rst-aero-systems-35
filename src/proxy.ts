import NextAuth from "next-auth";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { authConfig } from "@/lib/auth.config";
import {
  TRAFFIC_COOKIE,
  TRAFFIC_COOKIE_MAX_AGE,
  detectTrafficSource,
  encodeTrafficInfo,
  parseTrafficInfo,
  type TrafficInfo,
} from "@/lib/traffic-source";

const { auth } = NextAuth(authConfig);

const authGuard = auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;
  const role = req.auth?.user?.role;

  if (pathname.startsWith("/admin")) {
    if (pathname === "/admin/login") return NextResponse.next();
    if (!isLoggedIn || role !== "ADMIN") {
      return NextResponse.redirect(new URL("/admin/login", req.nextUrl));
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/account") && !isLoggedIn) {
    const url = new URL("/login", req.nextUrl);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
});

function ownHosts(req: NextRequest): string[] {
  const hosts = [req.nextUrl.hostname];
  const header = req.headers.get("host");
  if (header) hosts.push(header.split(":")[0]);
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (site) {
    try {
      hosts.push(new URL(site).hostname);
    } catch {}
  }
  return hosts;
}

/**
 * Запоминает, откуда пришёл посетитель (см. traffic-source.ts). Смотрим только
 * на загрузку документа: клиентские переходы Next (RSC) и префетчи несут внутренний реферер.
 */
function rememberTrafficSource(req: NextRequest, res: NextResponse): NextResponse {
  if (req.method !== "GET") return res;
  if (req.headers.has("rsc") || req.headers.has("next-router-prefetch") || req.nextUrl.searchParams.has("_rsc")) {
    return res;
  }
  const existing = parseTrafficInfo(req.cookies.get(TRAFFIC_COOKIE)?.value);
  const detected = detectTrafficSource(req.nextUrl.searchParams, req.headers.get("referer"), ownHosts(req));
  if (!detected && existing) return res;

  const info: TrafficInfo = {
    ...(detected ?? { source: "direct", medium: "direct" }),
    landing: req.nextUrl.pathname.slice(0, 200),
    at: new Date().toISOString(),
  };
  res.cookies.set(TRAFFIC_COOKIE, encodeTrafficInfo(info), {
    maxAge: TRAFFIC_COOKIE_MAX_AGE,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  return res;
}

export default async function proxy(req: NextRequest, event: NextFetchEvent) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/admin") || pathname.startsWith("/account")) {
    return authGuard(req, event as never);
  }
  return rememberTrafficSource(req, NextResponse.next());
}

export const config = {
  // Все страницы, кроме служебных путей и файлов (картинки, фид, robots, sitemap).
  matcher: ["/((?!_next/|api/|.*\\.[a-zA-Z0-9]+$).*)"],
};
