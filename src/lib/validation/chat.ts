import { z } from "zod";

export const customerChatMessageSchema = z.object({
  conversationToken: z.string().uuid().optional(),
  message: z.string().trim().min(1, "Напишите сообщение").max(2000, "Не более 2000 символов"),
  customerName: z.string().trim().max(80).optional(),
  customerContact: z.string().trim().max(120).optional(),
  pagePath: z.string().trim().max(500).optional(),
  productSlug: z.string().trim().max(200).optional(),
  privacyAccepted: z.boolean().refine((accepted) => accepted, "Подтвердите согласие с политикой конфиденциальности"),
  website: z.string().max(0).optional(), // honeypot
});

export const chatHistoryQuerySchema = z.object({
  token: z.string().uuid(),
});

export type CustomerChatMessageInput = z.infer<typeof customerChatMessageSchema>;
