import { SiteHeader } from "@/components/storefront/site-header";
import { BottomNav } from "@/components/storefront/bottom-nav";
import { Footer } from "@/components/storefront/footer";

// Витрина рендерится динамически (данные из БД всегда свежие),
// поэтому сборка не обращается к базе.
export const dynamic = "force-dynamic";

export default function StorefrontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main className="flex-1 pb-24 md:pb-0">{children}</main>
      <Footer />
      <BottomNav />
    </div>
  );
}
