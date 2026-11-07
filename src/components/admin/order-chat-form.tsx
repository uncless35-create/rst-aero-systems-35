"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { messageOrderCustomer } from "@/actions/admin/chats";

/** Сообщение покупателю заказа в чат на сайте: он увидит его, когда зайдёт в аккаунт. */
export function OrderChatForm({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();

  function send() {
    startTransition(async () => {
      const result = await messageOrderCustomer(orderId, body);
      if (result.ok) {
        toast.success("Сообщение отправлено в чат покупателя");
        setBody("");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="mt-4 rounded-3xl bg-background p-5 text-sm">
      <p className="font-semibold">Написать в чат на сайте</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Покупатель увидит сообщение в чате «Задать вопрос», когда зайдёт на сайт под своим аккаунтом.
        Ответ придёт вам в Telegram, как обычно.
      </p>
      <Textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="Добрый день! Ваш заказ сегодня будет отправлен…"
        maxLength={4000}
        rows={3}
        className="mt-3"
      />
      <Button size="sm" className="mt-3 gap-2" onClick={send} disabled={pending || !body.trim()}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        Отправить
      </Button>
    </div>
  );
}
