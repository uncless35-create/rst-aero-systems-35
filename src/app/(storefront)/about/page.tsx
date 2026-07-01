import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContentPage } from "@/components/storefront/content-page";
import { getSiteContent } from "@/lib/queries";

export async function generateMetadata(): Promise<Metadata> {
  const content = await getSiteContent("about");
  return { title: content?.title ?? "О компании" };
}

export default async function AboutPage() {
  const content = await getSiteContent("about");
  if (!content) notFound();
  return <ContentPage title={content.title} body={content.body} />;
}
