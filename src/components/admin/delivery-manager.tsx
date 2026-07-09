"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatRub, rublesToKopecks, kopecksToRubles } from "@/lib/money";
import {
  createDeliveryMethod,
  updateDeliveryMethod,
  deleteDeliveryMethod,
} from "@/actions/admin/delivery";

export type DeliveryRow = {
  id: string;
  name: string;
  description: string | null;
  priceKopecks: number;
  isActive: boolean;
  requiresAddress: boolean;
  provider: string | null;
  sortOrder: number;
};

type FormState = {
  name: string;
  description: string;
  priceRub: number;
  isActive: boolean;
  requiresAddress: boolean;
  isCdek: boolean;
  sortOrder: number;
};

const empty: FormState = {
  name: "",
  description: "",
  priceRub: 0,
  isActive: true,
  requiresAddress: true,
  isCdek: false,
  sortOrder: 0,
};

export function DeliveryManager({ methods }: { methods: DeliveryRow[] }) {
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

  function openEdit(m: DeliveryRow) {
    setEditingId(m.id);
    setForm({
      name: m.name,
      description: m.description ?? "",
      priceRub: kopecksToRubles(m.priceKopecks),
      isActive: m.isActive,
      requiresAddress: m.requiresAddress,
      isCdek: m.provider === "CDEK",
      sortOrder: m.sortOrder,
    });
    setOpen(true);
  }

  async function save() {
    setSaving(true);
    const payload = {
      name: form.name,
      description: form.description,
      priceKopecks: rublesToKopecks(form.priceRub),
      isActive: form.isActive,
      requiresAddress: form.requiresAddress,
      provider: form.isCdek ? "CDEK" : null,
      sortOrder: form.sortOrder,
    };
    const res = editingId
      ? await updateDeliveryMethod(editingId, payload)
      : await createDeliveryMethod(payload);
    setSaving(false);
    if (res.ok) {
      toast.success("Сохранено");
      setOpen(false);
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  async function remove(m: DeliveryRow) {
    if (!confirm(`Удалить способ «${m.name}»?`)) return;
    const res = await deleteDeliveryMethod(m.id);
    if (res.ok) {
      toast.success("Удалено");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={openCreate} className="gap-2">
          <Plus className="size-4" /> Добавить способ
        </Button>
      </div>

      <div className="overflow-hidden rounded-3xl bg-background">
        {methods.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">Способов доставки нет</p>
        ) : (
          <div className="divide-y divide-border">
            {methods.map((m) => (
              <div key={m.id} className="flex items-center gap-4 p-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{m.name}</p>
                    {!m.isActive && <span className="text-xs text-muted-foreground">(скрыт)</span>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {m.provider === "CDEK"
                      ? "СДЭК · расчёт по карте"
                      : m.priceKopecks === 0
                        ? "Бесплатно"
                        : formatRub(m.priceKopecks)}
                    {m.provider === "CDEK" ? "" : m.requiresAddress ? " · нужен адрес" : " · самовывоз"}
                  </p>
                </div>
                <button onClick={() => openEdit(m)} className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-surface hover:text-foreground" aria-label="Редактировать">
                  <Pencil className="size-4" />
                </button>
                <button onClick={() => remove(m)} className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-surface hover:text-destructive" aria-label="Удалить">
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
            <DialogTitle>{editingId ? "Редактировать способ" : "Новый способ доставки"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="d-name">Название</Label>
              <Input id="d-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="d-desc">Описание</Label>
              <Input id="d-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="flex gap-4">
              <div className="flex-1 space-y-2">
                <Label htmlFor="d-price">Цена, ₽</Label>
                <Input id="d-price" type="number" min={0} value={form.priceRub} onChange={(e) => setForm({ ...form, priceRub: Number(e.target.value) })} />
              </div>
              <div className="flex-1 space-y-2">
                <Label htmlFor="d-sort">Порядок</Label>
                <Input id="d-sort" type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-surface px-4 py-3">
              <Label htmlFor="d-active">Активен</Label>
              <Switch id="d-active" checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-surface px-4 py-3">
              <Label htmlFor="d-addr">Требуется адрес доставки</Label>
              <Switch id="d-addr" checked={form.requiresAddress} onCheckedChange={(v) => setForm({ ...form, requiresAddress: v })} />
            </div>
            <div className="rounded-2xl bg-surface px-4 py-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="d-cdek">Расчёт через СДЭК (карта ПВЗ)</Label>
                <Switch id="d-cdek" checked={form.isCdek} onCheckedChange={(v) => setForm({ ...form, isCdek: v })} />
              </div>
              {form.isCdek && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Стоимость считается автоматически по тарифу СДЭК при выборе города и пункта выдачи.
                  Поле «Цена» и «Требуется адрес» для этого способа не используются.
                </p>
              )}
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
