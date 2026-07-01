import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;
  const role = req.auth?.user?.role;

  // Админка: только для ADMIN (кроме страницы входа)
  if (pathname.startsWith("/admin")) {
    if (pathname === "/admin/login") return NextResponse.next();
    if (!isLoggedIn || role !== "ADMIN") {
      return NextResponse.redirect(new URL("/admin/login", req.nextUrl));
    }
    return NextResponse.next();
  }

  // Личный кабинет: только для авторизованных
  if (pathname.startsWith("/account")) {
    if (!isLoggedIn) {
      const url = new URL("/login", req.nextUrl);
      url.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/admin/:path*", "/account/:path*"],
};
