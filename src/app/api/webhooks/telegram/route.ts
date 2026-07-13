import { timingSafeEqual } from "node:crypto";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTelegramWebhookSecret } from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TelegramUpdate = {
  update_id?: number;
  message?: {
    message_id?: number;
    text?: string;
    caption?: string;
    chat?: { id?: number };
    from?: { is_bot?: boolean };
    reply_to_message?: { message_id?: number };
  };
};

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
  const configuredChatId = process.env.TELEGRAM_CHAT_ID;
  if (
    update?.update_id == null ||
    message?.message_id == null ||
    String(message.chat?.id) !== configuredChatId ||
    message.from?.is_bot
  ) {
    return NextResponse.json({ ok: true });
  }

  const body = (message.text || message.caption || "").trim().slice(0, 4000);
  const repliedMessageId = message.reply_to_message?.message_id;
  if (!body || !repliedMessageId) return NextResponse.json({ ok: true });

  const telegramUpdateId = String(update.update_id);
  const repliedMessage = await prisma.chatMessage.findUnique({
    where: { telegramMessageId: String(repliedMessageId) },
    select: { conversationId: true },
  });
  if (!repliedMessage) return NextResponse.json({ ok: true });

  try {
    await prisma.$transaction([
      prisma.chatMessage.create({
        data: {
          conversationId: repliedMessage.conversationId,
          sender: "MANAGER",
          body,
          deliveryStatus: "DELIVERED",
          telegramMessageId: String(message.message_id),
          telegramUpdateId,
        },
      }),
      prisma.chatConversation.update({
        where: { id: repliedMessage.conversationId },
        data: { status: "OPEN", lastMessageAt: new Date() },
      }),
    ]);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ ok: true });
    }
    throw error;
  }

  return NextResponse.json({ ok: true });
}
