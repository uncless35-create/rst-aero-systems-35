import { formatRub } from "@/lib/money";
import { cn } from "@/lib/utils";

export function Price({
  kopecks,
  oldKopecks,
  className,
  size = "md",
}: {
  kopecks: number;
  oldKopecks?: number | null;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizes = {
    sm: "text-base",
    md: "text-lg",
    lg: "text-3xl sm:text-4xl",
  };
  return (
    <div className={cn("flex items-baseline gap-2", className)}>
      <span className={cn("font-semibold tracking-tight", sizes[size])}>
        {formatRub(kopecks)}
      </span>
      {oldKopecks && oldKopecks > kopecks ? (
        <span className="text-sm text-muted-foreground line-through">
          {formatRub(oldKopecks)}
        </span>
      ) : null}
    </div>
  );
}
