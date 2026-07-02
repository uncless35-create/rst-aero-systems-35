import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "cyrillic"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Серверный рендеринг рядом с базой Supabase (eu-west-2, Лондон) — минимум задержек на запросы к БД.
export const preferredRegion = "lhr1";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "RST AERO SYSTEMS — FPV-дроны, тинивупы и комплектующие",
    template: "%s · RST AERO SYSTEMS",
  },
  description:
    "Интернет-магазин RST AERO SYSTEMS: FPV-дроны, тинивупы, синивупы, запчасти и аппаратура. Доставка по России, оплата картой и СБП.",
  keywords: [
    "FPV дрон", "купить FPV дрон", "тинивуп", "синивуп", "cinewhoop",
    "FPV очки", "аппаратура управления", "ELRS", "аккумулятор LiPo",
    "полётный контроллер", "RST AERO",
  ],
  openGraph: {
    type: "website",
    siteName: "RST AERO SYSTEMS",
    locale: "ru_RU",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ru"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
        {children}
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
