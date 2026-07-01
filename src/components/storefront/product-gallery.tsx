"use client";

import { useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight, ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

type GalleryImage = { url: string; alt: string | null };

export function ProductGallery({ images, name }: { images: GalleryImage[]; name: string }) {
  const [index, setIndex] = useState(0);
  const has = images.length > 0;
  const go = (dir: number) => setIndex((i) => (i + dir + images.length) % images.length);

  return (
    <div className="space-y-3">
      <div className="relative aspect-square overflow-hidden rounded-[2rem] bg-surface">
        {has ? (
          <AnimatePresence mode="wait">
            <motion.div
              key={index}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="absolute inset-0"
            >
              <Image
                src={images[index].url}
                alt={images[index].alt ?? name}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
              />
            </motion.div>
          </AnimatePresence>
        ) : (
          <div className="grid h-full place-items-center text-muted-foreground">
            <ImageOff className="size-10" />
          </div>
        )}

        {images.length > 1 && (
          <>
            <button
              onClick={() => go(-1)}
              aria-label="Предыдущее фото"
              className="absolute left-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-background/80 backdrop-blur transition-colors hover:bg-background"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              onClick={() => go(1)}
              aria-label="Следующее фото"
              className="absolute right-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-background/80 backdrop-blur transition-colors hover:bg-background"
            >
              <ChevronRight className="size-5" />
            </button>
            <div className="absolute inset-x-0 bottom-4 flex justify-center gap-1.5">
              {images.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setIndex(i)}
                  aria-label={`Фото ${i + 1}`}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    i === index ? "w-6 bg-primary" : "w-1.5 bg-primary/30"
                  )}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {images.length > 1 && (
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              className={cn(
                "relative aspect-square w-20 shrink-0 overflow-hidden rounded-2xl bg-surface transition-all",
                i === index ? "ring-2 ring-primary" : "opacity-70 hover:opacity-100"
              )}
            >
              <Image src={img.url} alt={img.alt ?? name} fill sizes="80px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
