import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Чаты" };
export const dynamic = "force-dynamic";

export default async function AdminChatsPage() {
  const conversations = await prisma.chatConversation.findMany({
    orderBy: { lastMessageAt: "desc" },
    include: {
      product: { select: { name: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
      _count: { select: { messages: true } },
    },
    take: 100,
  });

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-bold tracking-tight">Чаты с покупателями</h1>
      <p className="mt-1 text-sm text-muted-foreground">Ответы из Telegram и админ-панели появляются у посетителя на сайте.</p>

      <div className="mt-6 space-y-2">
        {conversations.length === 0 ? (
          <div className="rounded-3xl bg-background p-8 text-center text-muted-foreground">Сообщений пока нет.</div>
        ) : conversations.map((conversation) => {
          const lastMessage = conversation.messages[0];
          return (
            <Link key={conversation.id} href={`/admin/chats/${conversation.id}`} className="block rounded-3xl bg-background p-5 transition-colors hover:bg-surface-2">
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground"><MessageCircle className="size-5" /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold">{conversation.customerName || conversation.customerContact || `Чат ${conversation.id.slice(-8).toUpperCase()}`}</p>
                    <span className="shrink-0 text-xs text-muted-foreground">{conversation.lastMessageAt.toLocaleString("ru-RU")}</span>
                  </div>
                  {conversation.product ? <p className="mt-0.5 truncate text-xs text-muted-foreground">{conversation.product.name}</p> : null}
                  <p className="mt-2 truncate text-sm">{lastMessage?.body || "Без сообщений"}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{conversation.status === "OPEN" ? "Открыт" : "Закрыт"} · сообщений: {conversation._count.messages}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
