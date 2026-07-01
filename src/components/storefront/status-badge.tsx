import { cn } from "@/lib/utils";
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  type OrderStatus,
} from "@/lib/constants";

export function StatusBadge({ status }: { status: string }) {
  const s = status as OrderStatus;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium",
        ORDER_STATUS_COLORS[s] ?? "bg-surface text-foreground"
      )}
    >
      {ORDER_STATUS_LABELS[s] ?? status}
    </span>
  );
}
