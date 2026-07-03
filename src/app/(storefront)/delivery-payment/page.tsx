import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContentPage } from "@/components/storefront/content-page";
import { getSiteContent } from "@/lib/queries";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const content = await getSiteContent("delivery-payment");
  return { title: content?.title ?? "Доставка и оплата" };
}

export default async function DeliveryPaymentPage() {
  const content = await getSiteContent("delivery-payment");
  if (!content) notFound();
  return <ContentPage title={content.title} body={content.body} />;
}
