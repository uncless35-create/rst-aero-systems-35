"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertAdmin } from "@/lib/admin";

const schema = z.object({
  key: z.string().min(1),
  title: z.string().trim().min(2, "Укажите заголовок"),
  body: z.string().trim().min(1, "Заполните текст"),
});

export async function updateSiteContent(
  input: z.infer<typeof schema>
): Promise<{ ok: true } | { ok: false; error: string }> {
  await assertAdmin();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { key, title, body } = parsed.data;

  await prisma.siteContent.upsert({
    where: { key },
    update: { title, body },
    create: { key, title, body },
  });

  revalidateTag("content", "max");
  revalidatePath("/admin/pages");
  revalidatePath(`/${key}`);
  return { ok: true };
}
