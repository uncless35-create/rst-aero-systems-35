import { timingSafeEqual } from "node:crypto";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import {
  deliverManagerReplyToCustomer,
  handleTelegramCustomerMessage,
  startTelegramConversation,
} from "@/lib/chat";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getTelegramWebhookSecret } from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TelegramUpdate = {
  update_id?: number;
  message?: {
    message_id?: number;
    text?: string;
    caption?: string;
    chat?: { id?: number; type?: string };
    from?: { is_bot?: boolean; first_name?: string; username?: string };
    reply_to_message?: { message_id?: number };
  };
};

const ok = () => NextResponse.json({ ok: true });

function secretsMatch(actual: string | null, expected: string): boolean {
  if (!actual) return false;
  const left = Buffer.from(actual);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function POST(request: NextRequest) {
  const secret = getTelegramWebhookSecret();
  if (!secret) return NextResponse.json({ error: "Webhook не настроен" }, { status: 503 });

  if (!secretsMatch(request.headers.get("x-telegram-bot-api-secret-token"), secret)) {
    return NextResponse.json({ error: "Недействительная подпись" }, { status: 401 });
  }

  const update = (await request.json().catch(() => null)) as TelegramUpdate | null;
  const message = update?.message;
  if (update?.update_id == null || message?.message_id == null || message.from?.is_bot) {
    return ok();
  }

  const chatId = String(message.chat?.id);
  const body = (message.text || message.caption || "").trim().slice(0, 4000);
  if (!body) return ok();

  return chatId === process.env.TELEGRAM_CHAT_ID
    ? handleManagerReply(update, chatId, body)
    : handleCustomerMessage(update, chatId, body);
}

/** Владелец ответил реплаем на сообщение покупателя. */
async function handleManagerReply(update: TelegramUpdate, chatId: string, body: string) {
  const message = update.message!;
  const repliedMessageId = message.reply_to_message?.message_id;
  if (!repliedMessageId) return ok();

  const repliedMessage = await prisma.chatMessage.findUnique({
    where: { telegramMessageId: String(repliedMessageId) },
    select: {
      conversationId: true,
      conversation: { select: { telegramUserChatId: true } },
    },
  });
  if (!repliedMessage) return ok();

  // Диалог из Telegram — ответ уходит покупателю в бот; с сайта — его заберёт виджет.
  const deliveryStatus = await deliverManagerReplyToCustomer(repliedMessage.conversation, body);

  try {
    await prisma.$transaction([
      prisma.chatMessage.create({
        data: {
          conversationId: repliedMessage.conversationId,
          sender: "MANAGER",
          body,
          deliveryStatus: deliveryStatus === "SKIPPED" ? "DELIVERED" : deliveryStatus,
          telegramMessageId: String(message.message_id),
          telegramUpdateId: String(update.update_id),
        },
      }),
      prisma.chatConversation.update({
        where: { id: repliedMessage.conversationId },
        data: { status: "OPEN", lastMessageAt: new Date() },
      }),
    ]);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return ok(); // повтор того же update — уже обработан
    }
    throw error;
  }

  if (deliveryStatus === "FAILED") {
    console.error("Ответ менеджера не доставлен покупателю в Telegram", { chatId });
  }
  return ok();
}

/** Покупатель написал боту напрямую (кнопка «Написать в Telegram»). */
async function handleCustomerMessage(update: TelegramUpdate, chatId: string, body: string) {
  const message = update.message!;
  if (message.chat?.type !== "private") return ok();
  if (consumeRateLimit(`chat:tg:${chatId}`, 30, 60_000)) return ok();

  const profile = {
    telegramChatId: chatId,
    firstName: message.from?.first_name,
    username: message.from?.username,
  };

  const startMatch = /^\/start(?:@\w+)?(?:\s+(\S+))?$/.exec(body);
  if (startMatch) {
    await startTelegramConversation({ ...profile, startPayload: startMatch[1] });
    return ok();
  }
  if (body.startsWith("/")) return ok();

  try {
    await handleTelegramCustomerMessage({
      ...profile,
      updateId: String(update.update_id),
      body,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return ok(); // повтор того же update
    }
    throw error;
  }
  return ok();
}
