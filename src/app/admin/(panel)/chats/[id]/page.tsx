import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { ChatReplyForm } from "@/components/admin/chat-reply-form";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";

type Params = Promise<{ id: string }>;

export const metadata = { title: "Диалог" };
export const dynamic = "force-dynamic";

export default async function AdminChatPage({ params }: { params: Params }) {
  const { id } = await params;
  const conversation = await prisma.chatConversation.findUnique({
    where: { id },
    include: {
      product: { select: { name: true, slug: true } },
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!conversation) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/admin/chats" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ChevronLeft className="size-4" /> К чатам</Link>
      <div className="mb-6 mt-3 rounded-3xl bg-background p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">{conversation.customerName || `Чат ${conversation.id.slice(-8).toUpperCase()}`}</h1>
            {conversation.customerContact ? <p className="mt-1 text-sm">{conversation.customerContact}</p> : null}
            {conversation.product ? <Link href={`/product/${conversation.product.slug}`} target="_blank" className="mt-1 block text-sm text-muted-foreground hover:text-foreground">{conversation.product.name}</Link> : null}
            {conversation.pagePath ? <p className="mt-1 text-xs text-muted-foreground">Страница: {conversation.pagePath}</p> : null}
            <p className="mt-1 text-xs text-muted-foreground">
              {conversation.telegramUserChatId
                ? "Покупатель пишет из Telegram — ответ придёт ему в бот"
                : "Чат на сайте — ответ появится в виджете"}
            </p>
          </div>
          <span className="rounded-full bg-surface px-3 py-1 text-xs">{conversation.status === "OPEN" ? "Открыт" : "Закрыт"}</span>
        </div>
      </div>

      <div className="space-y-3 rounded-3xl bg-surface p-4 sm:p-6">
        {conversation.messages.map((message) => (
          <div key={message.id} className={cn("max-w-[85%] rounded-2xl px-4 py-3", message.sender === "CUSTOMER" ? "ml-auto bg-primary text-primary-foreground" : "bg-background")}>
            <p className="whitespace-pre-wrap break-words text-sm">{message.body}</p>
            <p className={cn("mt-1 text-[10px]", message.sender === "CUSTOMER" ? "text-white/60" : "text-muted-foreground")}>{message.createdAt.toLocaleString("ru-RU")}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-3xl bg-background p-5"><ChatReplyForm conversationId={conversation.id} status={conversation.status} /></div>
    </div>
  );
}
