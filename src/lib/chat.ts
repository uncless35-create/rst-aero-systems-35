import { randomUUID } from "node:crypto";
import type { ChatConversation, ChatMessage } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  escapeHtml,
  isTelegramConfigured,
  sendTelegramMessage,
  sendTelegramTo,
} from "@/lib/telegram";
import type { CustomerChatMessageInput } from "@/lib/validation/chat";
import { PRIVACY_POLICY_VERSION } from "@/lib/privacy";

function chatLabel(id: string): string {
  return id.slice(-8).toUpperCase();
}

function safePagePath(value?: string): string | null {
  if (!value?.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

export async function createCustomerChatMessage(
  input: CustomerChatMessageInput,
  userId?: string | null,
  defer?: (task: () => Promise<void>) => void,
) {
  const pagePath = safePagePath(input.pagePath);
  const requestedConversation = input.conversationToken
    ? await prisma.chatConversation.findUnique({ where: { publicToken: input.conversationToken } })
    : null;

  const conversationData = {
    status: "OPEN",
    lastMessageAt: new Date(),
    ...(input.customerName ? { customerName: input.customerName } : {}),
    ...(input.customerContact ? { customerContact: input.customerContact } : {}),
    ...(pagePath ? { pagePath } : {}),
    ...(userId && !requestedConversation?.userId ? { userId } : {}),
    ...(!requestedConversation?.privacyAcceptedAt
      ? { privacyAcceptedAt: new Date(), privacyPolicyVersion: PRIVACY_POLICY_VERSION }
      : {}),
  };

  let conversation: ChatConversation;
  let message: ChatMessage | undefined;
  if (requestedConversation) {
    [conversation, message] = await prisma.$transaction([
      prisma.chatConversation.update({
        where: { id: requestedConversation.id },
        data: conversationData,
      }),
      prisma.chatMessage.create({
        data: {
          conversationId: requestedConversation.id,
          sender: "CUSTOMER",
          body: input.message,
        },
      }),
    ]);
  } else {
    const created = await prisma.chatConversation.create({
      data: {
        publicToken: randomUUID(),
        customerName: input.customerName || null,
        customerContact: input.customerContact || null,
        pagePath,
        userId: userId || null,
        privacyAcceptedAt: new Date(),
        privacyPolicyVersion: PRIVACY_POLICY_VERSION,
        messages: { create: { sender: "CUSTOMER", body: input.message } },
      },
      include: { messages: { orderBy: { createdAt: "desc" }, take: 1 } },
    });
    conversation = created;
    message = created.messages[0];
  }

  if (!message) throw new Error("Сообщение чата не создано");

  const deliver = async () => {
    try {
      await deliverCustomerChatMessage(input, pagePath, conversation, message);
    } catch (error) {
      console.error("Доставка сообщения чата:", error);
      await prisma.chatMessage.update({
        where: { id: message.id },
        data: { deliveryStatus: isTelegramConfigured() ? "FAILED" : "SKIPPED" },
      }).catch(() => undefined);
    }
  };
  if (defer) defer(deliver);
  else await deliver();

  return {
    conversationToken: conversation.publicToken,
    message: {
      id: message.id,
      sender: message.sender,
      body: message.body,
      createdAt: message.createdAt.toISOString(),
    },
  };
}

async function deliverCustomerChatMessage(
  input: CustomerChatMessageInput,
  pagePath: string | null,
  conversation: ChatConversation,
  message: ChatMessage,
) {
  const product = input.productSlug
    ? await prisma.product.findFirst({
        where: { slug: input.productSlug, isActive: true },
        select: { id: true, name: true, slug: true },
      })
    : null;

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
  const contextPath = pagePath || (product ? `/product/${product.slug}` : null);
  const lines = [
    `<b>💬 Сообщение с сайта · чат ${chatLabel(conversation.id)}</b>`,
    product ? `<b>Товар:</b> ${escapeHtml(product.name)}` : null,
    input.customerName ? `<b>Имя:</b> ${escapeHtml(input.customerName)}` : null,
    input.customerContact ? `<b>Контакт:</b> ${escapeHtml(input.customerContact)}` : null,
    contextPath
      ? `<b>Страница:</b> ${escapeHtml(siteUrl ? `${siteUrl}${contextPath}` : contextPath)}`
      : null,
    "",
    escapeHtml(input.message),
    "",
    "<i>Ответьте на это сообщение — ответ появится у покупателя на сайте.</i>",
  ].filter((line): line is string => line !== null);

  const telegramResult = await sendTelegramMessage(lines.join("\n"), {
    replyToMessageId: conversation.telegramRootMessageId,
  });

  if (telegramResult.ok) {
    await prisma.$transaction(async (tx) => {
      await tx.chatMessage.update({
        where: { id: message.id },
        data: {
          deliveryStatus: "DELIVERED",
          telegramMessageId: telegramResult.messageId,
        },
      });
      if (product || !conversation.telegramRootMessageId) {
        await tx.chatConversation.update({
          where: { id: conversation.id },
          data: {
            ...(product ? { productId: product.id } : {}),
            ...(!conversation.telegramRootMessageId
              ? { telegramRootMessageId: telegramResult.messageId }
              : {}),
          },
        });
      }
    });
  } else {
    await prisma.$transaction(async (tx) => {
      await tx.chatMessage.update({
        where: { id: message.id },
        data: { deliveryStatus: isTelegramConfigured() ? "FAILED" : "SKIPPED" },
      });
      if (product) {
        await tx.chatConversation.update({
          where: { id: conversation.id },
          data: { productId: product.id },
        });
      }
    });
  }
}

/** Приветствие, которое бот шлёт покупателю на /start. */
export const TELEGRAM_GREETING = [
  "<b>RST AERO SYSTEMS</b>",
  "",
  "Здравствуйте! Это чат с менеджером магазина. Напишите вопрос о товаре, совместимости, доставке или заказе — ответим здесь же, в Telegram.",
  "",
  "<i>Отправляя сообщение, вы соглашаетесь на обработку персональных данных. Не отправляйте данные банковских карт и пароли.</i>",
].join("\n");

/**
 * Сообщение покупателя, пришедшее боту в личный чат.
 * Диалог тот же, что и на сайте: если покупатель пришёл по ссылке из виджета
 * (deep-link со своим publicToken), Telegram-чат привязывается к начатой переписке.
 */
export async function handleTelegramCustomerMessage(input: {
  telegramChatId: string;
  updateId: string;
  body: string;
  firstName?: string;
  username?: string;
  startPayload?: string;
}) {
  const conversation = await findOrCreateTelegramConversation(input);

  const message = await prisma.chatMessage.create({
    data: {
      conversationId: conversation.id,
      sender: "CUSTOMER",
      body: input.body,
      deliveryStatus: "PENDING",
      telegramUpdateId: input.updateId,
    },
  });

  const product = conversation.productId
    ? await prisma.product.findUnique({
        where: { id: conversation.productId },
        select: { name: true },
      })
    : null;

  const lines = [
    `<b>💬 Сообщение из Telegram · чат ${chatLabel(conversation.id)}</b>`,
    conversation.customerName ? `<b>Имя:</b> ${escapeHtml(conversation.customerName)}` : null,
    conversation.telegramUsername ? `<b>Контакт:</b> @${escapeHtml(conversation.telegramUsername)}` : null,
    product ? `<b>Товар:</b> ${escapeHtml(product.name)}` : null,
    "",
    escapeHtml(input.body),
    "",
    "<i>Ответьте на это сообщение — ответ придёт покупателю в Telegram.</i>",
  ].filter((line): line is string => line !== null);

  const sent = await sendTelegramMessage(lines.join("\n"), {
    replyToMessageId: conversation.telegramRootMessageId,
  });

  await prisma.$transaction(async (tx) => {
    await tx.chatMessage.update({
      where: { id: message.id },
      data: sent.ok
        ? { deliveryStatus: "DELIVERED", telegramMessageId: sent.messageId }
        : { deliveryStatus: isTelegramConfigured() ? "FAILED" : "SKIPPED" },
    });
    await tx.chatConversation.update({
      where: { id: conversation.id },
      data: {
        status: "OPEN",
        lastMessageAt: new Date(),
        ...(sent.ok && !conversation.telegramRootMessageId
          ? { telegramRootMessageId: sent.messageId }
          : {}),
      },
    });
  });
}

/** /start от покупателя: завести (или подхватить) диалог до первого сообщения. */
export async function startTelegramConversation(input: {
  telegramChatId: string;
  firstName?: string;
  username?: string;
  startPayload?: string;
}) {
  await findOrCreateTelegramConversation(input);
  await sendTelegramTo(input.telegramChatId, TELEGRAM_GREETING);
}

async function findOrCreateTelegramConversation(input: {
  telegramChatId: string;
  firstName?: string;
  username?: string;
  startPayload?: string;
}): Promise<ChatConversation> {
  const existing = await prisma.chatConversation.findUnique({
    where: { telegramUserChatId: input.telegramChatId },
  });
  const profile = {
    telegramUsername: input.username || null,
    ...(input.firstName ? { customerName: input.firstName } : {}),
    ...(input.username ? { customerContact: `@${input.username}` } : {}),
  };

  if (existing) {
    return prisma.chatConversation.update({ where: { id: existing.id }, data: profile });
  }

  // Покупатель пришёл по ссылке из виджета: подхватываем начатый на сайте диалог.
  const fromWidget = input.startPayload
    ? await prisma.chatConversation.findFirst({
        where: { publicToken: input.startPayload, telegramUserChatId: null },
      })
    : null;

  const data = {
    ...profile,
    telegramUserChatId: input.telegramChatId,
    status: "OPEN",
    lastMessageAt: new Date(),
    privacyAcceptedAt: new Date(),
    privacyPolicyVersion: PRIVACY_POLICY_VERSION,
  };

  try {
    if (fromWidget) {
      return await prisma.chatConversation.update({
        where: { id: fromWidget.id },
        data: {
          ...data,
          ...(fromWidget.privacyAcceptedAt
            ? { privacyAcceptedAt: fromWidget.privacyAcceptedAt }
            : {}),
        },
      });
    }
    return await prisma.chatConversation.create({
      data: { ...data, publicToken: randomUUID() },
    });
  } catch (error) {
    // Гонка одновременных сообщений: диалог для этого чата уже создан соседним запросом.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const created = await prisma.chatConversation.findUnique({
        where: { telegramUserChatId: input.telegramChatId },
      });
      if (created) return created;
    }
    throw error;
  }
}

/**
 * Ответ менеджера покупателю, который пишет из Telegram.
 * Для диалогов с сайта возвращает SKIPPED — там ответ забирает виджет.
 */
export async function deliverManagerReplyToCustomer(
  conversation: Pick<ChatConversation, "telegramUserChatId">,
  body: string,
): Promise<"DELIVERED" | "FAILED" | "SKIPPED"> {
  if (!conversation.telegramUserChatId) return "SKIPPED";
  const sent = await sendTelegramTo(
    conversation.telegramUserChatId,
    `<b>Менеджер RST AERO:</b>\n\n${escapeHtml(body)}`,
  );
  return sent.ok ? "DELIVERED" : "FAILED";
}

export async function getChatHistory(publicToken: string) {
  const [conversation] = await prisma.$transaction([
    prisma.chatConversation.findUnique({
      where: { publicToken },
      select: {
        id: true,
        status: true,
        messages: {
          orderBy: { createdAt: "asc" },
          take: 100,
          select: { id: true, sender: true, body: true, createdAt: true },
        },
      },
    }),
    prisma.chatMessage.updateMany({
      where: {
        conversation: { is: { publicToken } },
        sender: "MANAGER",
        readAt: null,
      },
      data: { readAt: new Date() },
    }),
  ]);
  if (!conversation) return null;

  return {
    status: conversation.status,
    messages: conversation.messages.map((message) => ({
      ...message,
      createdAt: message.createdAt.toISOString(),
    })),
  };
}
