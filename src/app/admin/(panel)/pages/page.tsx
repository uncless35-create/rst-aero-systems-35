import { prisma } from "@/lib/prisma";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { PagesEditor, type PageContent } from "@/components/admin/pages-editor";

export const metadata = { title: "Страницы" };

const PAGE_DEFS: { key: PageContent["key"]; label: string }[] = [
  { key: "about", label: "О компании" },
  { key: "delivery-payment", label: "Доставка и оплата" },
  { key: "contacts", label: "Контакты" },
];

export default async function AdminPagesPage() {
  const contents = await prisma.siteContent.findMany();
  const byKey = new Map(contents.map((c) => [c.key, c]));

  const pages: PageContent[] = PAGE_DEFS.map((def) => {
    const c = byKey.get(def.key);
    return {
      key: def.key,
      label: def.label,
      title: c?.title ?? def.label,
      body: c?.body ?? "",
    };
  });

  return (
    <div className="mx-auto max-w-3xl">
      <AdminPageHeader title="Информационные страницы" description="Тексты страниц сайта" />
      <PagesEditor pages={pages} />
    </div>
  );
}
