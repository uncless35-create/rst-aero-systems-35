import { Loader2 } from "lucide-react";

export default function StorefrontLoading() {
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <Loader2 className="size-7 animate-spin text-muted-foreground" />
    </div>
  );
}
