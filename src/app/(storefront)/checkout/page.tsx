import type { Metadata } from "next";
import { CheckoutForm } from "@/components/storefront/checkout-form";
import { getActiveDeliveryMethods } from "@/lib/queries";
import { isCdekProduction } from "@/lib/cdek";

export const metadata: Metadata = { title: "Оформление заказа" };

export default async function CheckoutPage() {
  const deliveryMethods = await getActiveDeliveryMethods();

  return (
    <div className="mx-auto max-w-5xl px-4 pt-6">
      <h1 className="text-2xl font-bold tracking-tight">Оформление заказа</h1>
      <div className="mt-6">
        <CheckoutForm
          cdekReady={isCdekProduction()}
          deliveryMethods={deliveryMethods.map((d) => ({
            id: d.id,
            name: d.name,
            description: d.description,
            priceKopecks: d.priceKopecks,
            requiresAddress: d.requiresAddress,
            provider: d.provider,
          }))}
        />
      </div>
    </div>
  );
}
