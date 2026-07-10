"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertAdmin } from "@/lib/admin";
import { slugify } from "@/lib/slug";
import { productSchema, type ProductInput } from "@/lib/validation/product";

export type ProductActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

function revalidate(slug?: string) {
  revalidateTag("products", "max");
  revalidatePath("/admin/products");
  revalidatePath("/catalog");
  revalidatePath("/");
  if (slug) revalidatePath(`/product/${slug}`);
}

async function resolveSlug(name: string, provided: string | undefined, excludeId?: string) {
  const base = provided?.trim() ? slugify(provided) : slugify(name);
  let slug = base || `tovar-${Date.now()}`;
  let n = 1;
  // Гарантируем уникальность
  while (true) {
    const conflict = await prisma.product.findFirst({
      where: { slug, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
      select: { id: true },
    });
    if (!conflict) return slug;
    n += 1;
    slug = `${base}-${n}`;
  }
}

export async function createProduct(input: ProductInput): Promise<ProductActionResult> {
  await assertAdmin();
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const data = parsed.data;

  const slug = await resolveSlug(data.name, data.slug);

  const product = await prisma.product.create({
    data: {
      name: data.name,
      slug,
      categoryId: data.categoryId,
      description: data.description || null,
      priceKopecks: data.priceKopecks,
      oldPriceKopecks: data.oldPriceKopecks ?? null,
      stockQty: data.stockQty,
      weightGrams: data.weightGrams ?? null,
      isActive: data.isActive,
      outOfStock: data.outOfStock,
      isFeatured: data.isFeatured,
      badge: data.badge || null,
      variantLabel: data.variantLabel || null,
      attributes: data.attributes.length ? JSON.stringify(data.attributes) : null,
      images: {
        create: data.images.map((img, i) => ({ url: img.url, alt: img.alt || null, sortOrder: i })),
      },
      variants: {
        create: data.variants.map((v, i) => ({
          name: v.name,
          priceKopecks: v.priceKopecks ?? null,
          stockQty: v.stockQty,
          sku: v.sku || null,
          sortOrder: i,
        })),
      },
    },
  });

  revalidate(slug);
  return { ok: true, id: product.id };
}

export async function updateProduct(id: string, input: ProductInput): Promise<ProductActionResult> {
  await assertAdmin();
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const data = parsed.data;

  const existing = await prisma.product.findUnique({
    where: { id },
    include: { variants: true },
  });
  if (!existing) return { ok: false, error: "Товар не найден" };

  const slug = await resolveSlug(data.name, data.slug, id);

  await prisma.$transaction(async (tx) => {
    await tx.product.update({
      where: { id },
      data: {
        name: data.name,
        slug,
        categoryId: data.categoryId,
        description: data.description || null,
        priceKopecks: data.priceKopecks,
        oldPriceKopecks: data.oldPriceKopecks ?? null,
        stockQty: data.stockQty,
        weightGrams: data.weightGrams ?? null,
        isActive: data.isActive,
        outOfStock: data.outOfStock,
        isFeatured: data.isFeatured,
        badge: data.badge || null,
        variantLabel: data.variantLabel || null,
        attributes: data.attributes.length ? JSON.stringify(data.attributes) : null,
      },
    });

    // Изображения: пересоздаём
    await tx.productImage.deleteMany({ where: { productId: id } });
    if (data.images.length) {
      await tx.productImage.createMany({
        data: data.images.map((img, i) => ({ productId: id, url: img.url, alt: img.alt || null, sortOrder: i })),
      });
    }

    // Варианты: upsert по id, удаляем отсутствующие (снимок в заказах сохраняется)
    const keepIds = data.variants.filter((v) => v.id).map((v) => v.id!) as string[];
    await tx.productVariant.deleteMany({
      where: { productId: id, id: { notIn: keepIds.length ? keepIds : ["__none__"] } },
    });
    for (let i = 0; i < data.variants.length; i++) {
      const v = data.variants[i];
      if (v.id) {
        await tx.productVariant.update({
          where: { id: v.id },
          data: { name: v.name, priceKopecks: v.priceKopecks ?? null, stockQty: v.stockQty, sku: v.sku || null, sortOrder: i },
        });
      } else {
        await tx.productVariant.create({
          data: { productId: id, name: v.name, priceKopecks: v.priceKopecks ?? null, stockQty: v.stockQty, sku: v.sku || null, sortOrder: i },
        });
      }
    }
  });

  revalidate(slug);
  return { ok: true, id };
}

export async function deleteProduct(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  await assertAdmin();
  // OrderItem.productId → SetNull (снимок сохраняется), поэтому удаление безопасно
  await prisma.product.delete({ where: { id } });
  revalidate();
  return { ok: true };
}

export async function toggleProductActive(id: string, isActive: boolean) {
  await assertAdmin();
  await prisma.product.update({ where: { id }, data: { isActive } });
  revalidate();
  return { ok: true as const };
}
