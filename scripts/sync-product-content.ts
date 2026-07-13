import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { productContent, validateProductContent } from "../src/data/product-content";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");
const verifiedOnly = process.argv.includes("--verified-only");
const checkedAt = new Date("2026-07-13T00:00:00.000Z");

async function main() {
  const validationErrors = validateProductContent();
  if (validationErrors.length) {
    console.error(validationErrors.join("\n"));
    process.exitCode = 1;
    return;
  }

  const products = await prisma.product.findMany({
    where: { isActive: true },
    select: { id: true, slug: true, name: true },
  });
  const databaseSlugs = new Set(products.map((product) => product.slug));
  const contentSlugs = new Set(productContent.map((record) => record.slug));
  const missing = products.filter((product) => !contentSlugs.has(product.slug));
  const stale = productContent.filter((record) => !databaseSlugs.has(record.slug));

  if (missing.length || stale.length) {
    if (missing.length) {
      console.error(`Нет контента для активных товаров:\n${missing.map((product) => `- ${product.slug} (${product.name})`).join("\n")}`);
    }
    if (stale.length) {
      console.error(`В реестре нет соответствующего активного товара:\n${stale.map((record) => `- ${record.slug}`).join("\n")}`);
    }
    process.exitCode = 1;
    return;
  }

  const selected = verifiedOnly
    ? productContent.filter((record) => record.status === "VERIFIED")
    : productContent;
  const verified = productContent.filter((record) => record.status === "VERIFIED").length;
  const needsReview = productContent.length - verified;
  const primaryImageOverrides = selected.filter((record) => record.primaryImageUrl).length;

  console.log(`Активных товаров: ${products.length}`);
  console.log(`Проверено по источникам: ${verified}`);
  console.log(`Требует сверки версии/комплекта: ${needsReview}`);
  console.log(`Выбрано для ${apply ? "обновления" : "проверки"}: ${selected.length}`);
  console.log(`Заданных замен главного фото: ${primaryImageOverrides}`);

  if (!apply) {
    console.log("База не изменена. Для записи используйте --apply; для проверенных позиций — --apply --verified-only.");
    return;
  }

  for (const record of selected) {
    const product = await prisma.product.update({
      where: { slug: record.slug },
      data: {
        ...(record.name ? { name: record.name } : {}),
        summary: record.summary,
        exactVariant: record.exactVariant,
        description: record.description,
        compatibility: record.compatibility,
        packageContents: record.packageContents,
        attributes: JSON.stringify(record.attributes),
        contentSources: record.sources.length ? JSON.stringify(record.sources) : null,
        contentStatus: record.status,
        contentReviewNote: record.reviewNote || null,
        contentVerifiedAt: record.status === "VERIFIED" ? checkedAt : null,
      },
    });

    if (record.primaryImageUrl) {
      const primaryImage = await prisma.productImage.findFirst({
        where: { productId: product.id },
        orderBy: { sortOrder: "asc" },
      });
      if (primaryImage) {
        await prisma.productImage.update({
          where: { id: primaryImage.id },
          data: { url: record.primaryImageUrl, alt: record.name ?? product.name },
        });
      }
    } else if (record.name) {
      await prisma.productImage.updateMany({
        where: { productId: product.id },
        data: { alt: record.name },
      });
    }
  }

  console.log(`Обновлено товаров: ${selected.length}. Цена, остатки и варианты не изменялись; заданных замен главного фото: ${primaryImageOverrides}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
