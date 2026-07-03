import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, ImageOff } from "lucide-react";

type CategoryCard = {
  id: string;
  name: string;
  slug: string;
  image: string | null;
  productCount: number;
};

export function CategoryGrid({ categories }: { categories: CategoryCard[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {categories.map((c) => (
        <Link
          key={c.id}
          href={`/catalog/${c.slug}`}
          className="group relative aspect-[4/5] overflow-hidden rounded-3xl bg-surface"
        >
          {c.image ? (
            <Image
              src={c.image}
              alt={c.name}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="grid h-full place-items-center text-muted-foreground">
              <ImageOff className="size-8" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-4">
            <div>
              <p className="font-semibold leading-tight text-white">{c.name}</p>
              <p className="text-xs text-white/70">{c.productCount} тов.</p>
            </div>
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white/90 text-foreground transition-transform group-hover:scale-110">
              <ArrowUpRight className="size-4" />
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
