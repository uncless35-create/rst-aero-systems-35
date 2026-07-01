"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Upload, Link2, Trash2, ArrowUp, ArrowDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { uploadImageAction } from "@/actions/admin/upload";

export type ImageValue = { url: string; alt?: string | null };

export function ImageUploader({
  value,
  onChange,
}: {
  value: ImageValue[];
  onChange: (images: ImageValue[]) => void;
}) {
  const [url, setUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function addUrl() {
    const trimmed = url.trim();
    if (!trimmed) return;
    try {
      new URL(trimmed);
    } catch {
      toast.error("Некорректная ссылка");
      return;
    }
    onChange([...value, { url: trimmed }]);
    setUrl("");
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.set("file", file);
    const res = await uploadImageAction(fd);
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
    if (res.ok) {
      onChange([...value, { url: res.url }]);
      toast.success("Изображение загружено");
    } else {
      toast.error(res.error);
    }
  }

  function remove(i: number) {
    onChange(value.filter((_, idx) => idx !== i));
  }

  function move(i: number, dir: -1 | 1) {
    const next = [...value];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }

  return (
    <div className="space-y-3">
      {value.length > 0 && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {value.map((img, i) => (
            <div key={`${img.url}-${i}`} className="group relative aspect-square overflow-hidden rounded-2xl bg-surface">
              <Image src={img.url} alt="" fill sizes="120px" className="object-cover" />
              {i === 0 && (
                <span className="absolute left-1 top-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
                  Главное
                </span>
              )}
              <div className="absolute inset-x-0 bottom-0 flex justify-center gap-1 bg-black/40 p-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button type="button" onClick={() => move(i, -1)} className="grid size-6 place-items-center rounded-full bg-background/90" aria-label="Влево">
                  <ArrowUp className="size-3 rotate-[-90deg]" />
                </button>
                <button type="button" onClick={() => move(i, 1)} className="grid size-6 place-items-center rounded-full bg-background/90" aria-label="Вправо">
                  <ArrowDown className="size-3 rotate-[-90deg]" />
                </button>
                <button type="button" onClick={() => remove(i)} className="grid size-6 place-items-center rounded-full bg-background/90 text-destructive" aria-label="Удалить">
                  <Trash2 className="size-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <div className="flex flex-1 gap-2">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Ссылка на изображение (https://…)"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addUrl();
              }
            }}
          />
          <Button type="button" variant="surface" onClick={addUrl} className="gap-1">
            <Link2 className="size-4" /> Добавить
          </Button>
        </div>
        <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading} className="gap-1">
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          Загрузить файл
        </Button>
        <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
      </div>
    </div>
  );
}
