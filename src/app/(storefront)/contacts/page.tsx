import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContentPage } from "@/components/storefront/content-page";
import { getSiteContent } from "@/lib/queries";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const content = await getSiteContent("contacts");
  return { title: content?.title ?? "Контакты" };
}

export default async function ContactsPage() {
  const content = await getSiteContent("contacts");
  if (!content) notFound();
  return <ContentPage title={content.title} body={content.body} />;
}
