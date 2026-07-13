"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { replyToChat, setChatStatus } from "@/actions/admin/chats";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function ChatReplyForm({ conversationId, status }: { conversationId: string; status: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!body.trim()) return;
    setSaving(true);
    const result = await replyToChat(conversationId, body);
    setSaving(false);
    if (!result.ok) return toast.error(result.error);
    setBody("");
    toast.success("Ответ отправлен в чат на сайте");
    router.refresh();
  }

  async function toggleStatus() {
    setSaving(true);
    await setChatStatus(conversationId, status === "OPEN" ? "CLOSED" : "OPEN");
    setSaving(false);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <Textarea value={body} onChange={(event) => setBody(event.target.value)} rows={4} maxLength={4000} placeholder="Ответ покупателю…" />
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={submit} disabled={saving || !body.trim()}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          Отправить на сайт
        </Button>
        <Button type="button" variant="surface" onClick={toggleStatus} disabled={saving}>
          {status === "OPEN" ? "Закрыть диалог" : "Открыть диалог"}
        </Button>
      </div>
    </div>
  );
}
