"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateSiteContent } from "@/actions/admin/pages";

export type PageContent = {
  key: "about" | "delivery-payment" | "contacts";
  label: string;
  title: string;
  body: string;
};

function Editor({ page }: { page: PageContent }) {
  const router = useRouter();
  const [title, setTitle] = useState(page.title);
  const [body, setBody] = useState(page.body);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const res = await updateSiteContent({ key: page.key, title, body });
    setSaving(false);
    if (res.ok) {
      toast.success("Страница сохранена");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <div className="space-y-4 rounded-3xl bg-background p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{page.label}</h2>
        <span className="text-xs text-muted-foreground">/{page.key}</span>
      </div>
      <div className="space-y-2">
        <Label>Заголовок</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>Текст</Label>
        <Textarea rows={7} value={body} onChange={(e) => setBody(e.target.value)} />
        <p className="text-xs text-muted-foreground">Каждая строка — отдельный абзац.</p>
      </div>
      <Button onClick={save} disabled={saving}>
        {saving ? <Loader2 className="size-4 animate-spin" /> : "Сохранить"}
      </Button>
    </div>
  );
}

export function PagesEditor({ pages }: { pages: PageContent[] }) {
  return (
    <div className="space-y-4">
      {pages.map((p) => (
        <Editor key={p.key} page={p} />
      ))}
    </div>
  );
}
