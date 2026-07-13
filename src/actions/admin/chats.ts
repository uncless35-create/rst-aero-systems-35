"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/admin";
import { deliverManagerReplyToCustomer } from "@/lib/chat";
import { prisma } from "@/lib/prisma";

export async function replyToChat(conversationId: string, rawBody: string) {
  await assertAdmin();
  const body = rawBody.trim();
  if (!body) return { ok: false as const, error: "Напишите ответ" };
  if (body.length > 4000) return { ok: false as const, error: "Не более 4000 символов" };

  const conversation = await prisma.chatConversation.findUnique({
    where: { id: conversationId },
    select: { id: true, telegramUserChatId: true },
  });
  if (!conversation) return { ok: false as const, error: "Диалог не найден" };

  // Покупателю из Telegram ответ нужно доставить в бот; с сайта — его заберёт виджет.
  const deliveryStatus = await deliverManagerReplyToCustomer(conversation, body);
  if (deliveryStatus === "FAILED") {
    return { ok: false as const, error: "Telegram недоступен, ответ не отправлен. Попробуйте ещё раз." };
  }

  await prisma.$transaction([
    prisma.chatMessage.create({
      data: {
        conversationId,
        sender: "MANAGER",
        body,
        deliveryStatus: deliveryStatus === "DELIVERED" ? "DELIVERED" : "SKIPPED",
      },
    }),
    prisma.chatConversation.update({
      where: { id: conversationId },
      data: { status: "OPEN", lastMessageAt: new Date() },
    }),
  ]);
  revalidatePath("/admin/chats");
  revalidatePath(`/admin/chats/${conversationId}`);
  return { ok: true as const };
}

export async function setChatStatus(conversationId: string, status: "OPEN" | "CLOSED") {
  await assertAdmin();
  await prisma.chatConversation.update({ where: { id: conversationId }, data: { status } });
  revalidatePath("/admin/chats");
  revalidatePath(`/admin/chats/${conversationId}`);
  return { ok: true as const };
}
