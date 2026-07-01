"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createCategory, updateCategory, deleteCategory } from "@/actions/admin/categories";

export type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
  isVisible: boolean;
  productCount: number;
};

type FormState = {
  name: string;
  slug: string;
  description: string;
  sortOrder: number;
  isVisible: boolean;
};

const empty: FormState = { name: "", slug: "", description: "", sortOrder: 0, isVisible: true };

export function CategoriesManager({ categories }: { categories: CategoryRow[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(empty);
  const [saving, setSaving] = useState(false);

  function openCreate() {
    setEditingId(null);
    setForm(empty);
    setOpen(true);
  }

  function openEdit(c: CategoryRow) {
    setEditingId(c.id);
    setForm({
      name: c.name,
      slug: c.slug,
      description: c.description ?? "",
      sortOrder: c.sortOrder,
      isVisible: c.isVisible,
    });
    setOpen(true);
  }

  async function save() {
    setSaving(true);
    const res = editingId
      ? await updateCategory(editingId, form)
      : await createCategory(form);
    setSaving(false);
    if (res.ok) {
      toast.success(editingId ? "Категория обновлена" : "Категория создана");
      setOpen(false);
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  async function remove(c: CategoryRow) {
    if (!confirm(`Удалить категорию «${c.name}»?`)) return;
    const res = await deleteCategory(c.id);
    if (res.ok) {
      toast.success("Категория удалена");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={openCreate} className="gap-2">
          <Plus className="size-4" /> Добавить категорию
        </Button>
      </div>

      <div className="overflow-hidden rounded-3xl bg-background">
        {categories.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">Категорий пока нет</p>
        ) : (
          <div className="divide-y divide-border">
            {categories.map((c) => (
              <div key={c.id} className="flex items-center gap-4 p-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{c.name}</p>
                    {!c.isVisible && <EyeOff className="size-3.5 text-muted-foreground" />}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    /{c.slug} · товаров: {c.productCount} · порядок: {c.sortOrder}
                  </p>
                </div>
                <button
                  onClick={() => openEdit(c)}
                  className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-surface hover:text-foreground"
                  aria-label="Редактировать"
                >
                  <Pencil className="size-4" />
                </button>
                <button
                  onClick={() => remove(c)}
                  className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-surface hover:text-destructive"
                  aria-label="Удалить"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Редактировать категорию" : "Новая категория"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cat-name">Название</Label>
              <Input id="cat-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-slug">Адрес (slug)</Label>
              <Input id="cat-slug" value={form.slug} placeholder="оставьте пустым для авто" onChange={(e) => setForm({ ...form, slug: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-desc">Описание</Label>
              <Textarea id="cat-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="flex items-center gap-4">
              <div className="flex-1 space-y-2">
                <Label htmlFor="cat-sort">Порядок</Label>
                <Input id="cat-sort" type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch id="cat-vis" checked={form.isVisible} onCheckedChange={(v) => setForm({ ...form, isVisible: v })} />
                <Label htmlFor="cat-vis" className="flex items-center gap-1">
                  <Eye className="size-3.5" /> Показывать
                </Label>
              </div>
            </div>
            <Button onClick={save} disabled={saving} className="w-full">
              {saving ? <Loader2 className="size-4 animate-spin" /> : "Сохранить"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
