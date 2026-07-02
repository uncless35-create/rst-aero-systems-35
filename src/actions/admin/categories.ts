"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertAdmin } from "@/lib/admin";
import { slugify } from "@/lib/slug";

const schema = z.object({
  name: z.string().trim().min(2, "Укажите название"),
  slug: z.string().trim().optional(),
  description: z.string().trim().optional(),
  sortOrder: z.coerce.number().int().default(0),
  isVisible: z.boolean().default(true),
});

export type ActionResult = { ok: true } | { ok: false; error: string };

function revalidate() {
  revalidateTag("categories", "max");
  revalidateTag("products", "max");
  revalidatePath("/admin/categories");
  revalidatePath("/catalog");
  revalidatePath("/");
}

export async function createCategory(input: z.input<typeof schema>): Promise<ActionResult> {
  await assertAdmin();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const data = parsed.data;

  const slug = data.slug?.trim() ? slugify(data.slug) : slugify(data.name);
  const exists = await prisma.category.findUnique({ where: { slug } });
  if (exists) return { ok: false, error: "Категория с таким адресом уже существует" };

  await prisma.category.create({
    data: {
      name: data.name,
      slug,
      description: data.description || null,
      sortOrder: data.sortOrder,
      isVisible: data.isVisible,
    },
  });
  revalidate();
  return { ok: true };
}

export async function updateCategory(
  id: string,
  input: z.input<typeof schema>
): Promise<ActionResult> {
  await assertAdmin();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const data = parsed.data;

  const slug = data.slug?.trim() ? slugify(data.slug) : slugify(data.name);
  const conflict = await prisma.category.findFirst({ where: { slug, NOT: { id } } });
  if (conflict) return { ok: false, error: "Категория с таким адресом уже существует" };

  await prisma.category.update({
    where: { id },
    data: {
      name: data.name,
      slug,
      description: data.description || null,
      sortOrder: data.sortOrder,
      isVisible: data.isVisible,
    },
  });
  revalidate();
  return { ok: true };
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  await assertAdmin();
  const count = await prisma.product.count({ where: { categoryId: id } });
  if (count > 0) {
    return { ok: false, error: `Нельзя удалить: в категории ${count} товаров` };
  }
  await prisma.category.delete({ where: { id } });
  revalidate();
  return { ok: true };
}
