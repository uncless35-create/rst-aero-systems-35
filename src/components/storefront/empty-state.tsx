import { PackageOpen } from "lucide-react";

export function EmptyState({
  title,
  description,
  icon: Icon = PackageOpen,
  children,
}: {
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  children?: React.ReactNode;
}) {
  return (
    <div className="grid place-items-center rounded-3xl bg-surface px-6 py-16 text-center">
      <div className="mb-4 grid size-14 place-items-center rounded-full bg-background">
        <Icon className="size-6 text-muted-foreground" />
      </div>
      <p className="text-lg font-semibold">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      ) : null}
      {children ? <div className="mt-6">{children}</div> : null}
    </div>
  );
}
