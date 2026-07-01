import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <div className="text-center">
        <p className="text-7xl font-bold tracking-tight">404</p>
        <p className="mt-3 text-lg font-medium">Страница не найдена</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Возможно, товар снят с продажи или ссылка устарела.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button asChild>
            <Link href="/">На главную</Link>
          </Button>
          <Button asChild variant="surface">
            <Link href="/catalog">В каталог</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
