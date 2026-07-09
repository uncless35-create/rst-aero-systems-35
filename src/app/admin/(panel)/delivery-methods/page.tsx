import { prisma } from "@/lib/prisma";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { DeliveryManager } from "@/components/admin/delivery-manager";

export const metadata = { title: "Доставка" };

export default async function AdminDeliveryPage() {
  const methods = await prisma.deliveryMethod.findMany({ orderBy: { sortOrder: "asc" } });

  return (
    <div className="mx-auto max-w-3xl">
      <AdminPageHeader title="Способы доставки" description="Названия и стоимость доставки" />
      <DeliveryManager
        methods={methods.map((m) => ({
          id: m.id,
          name: m.name,
          description: m.description,
          priceKopecks: m.priceKopecks,
          isActive: m.isActive,
          requiresAddress: m.requiresAddress,
          provider: m.provider,
          sortOrder: m.sortOrder,
        }))}
      />
    </div>
  );
}
