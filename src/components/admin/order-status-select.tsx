"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateOrderStatus } from "@/actions/admin/orders";
import { ORDER_STATUSES, ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/constants";

export function OrderStatusSelect({
  orderId,
  status,
}: {
  orderId: string;
  status: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(status);
  const [saving, setSaving] = useState(false);

  async function onChange(next: string) {
    setValue(next);
    setSaving(true);
    const res = await updateOrderStatus(orderId, next as OrderStatus);
    setSaving(false);
    if (res.ok) {
      toast.success("Статус обновлён");
      router.refresh();
    } else {
      toast.error(res.error);
      setValue(status);
    }
  }

  return (
    <select
      value={value}
      disabled={saving}
      onChange={(e) => onChange(e.target.value)}
      className="h-11 rounded-2xl border border-input bg-background px-4 text-sm font-medium disabled:opacity-50"
    >
      {ORDER_STATUSES.map((s) => (
        <option key={s} value={s}>
          {ORDER_STATUS_LABELS[s]}
        </option>
      ))}
    </select>
  );
}
