import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();

// --- Транслитерация для slug ---
const TR: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
  и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch",
  ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};
function slugify(input: string): string {
  return input.toLowerCase().trim().split("").map((c) => (c in TR ? TR[c] : c)).join("")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

function cleanName(raw: string): string {
  return raw.normalize("NFC").replace(/\.(jpe?g|png)$/i, "").replace(/\s+/g, " ").trim()
    .replace(/Аккамулятор/gi, (m) => (m[0] === "А" ? "Аккумулятор" : "аккумулятор"));
}

const CATALOG_DIR = path.join(process.cwd(), "каталог");
const PUBLIC_DIR = path.join(process.cwd(), "public", "products");

// Причёсанные названия, описания и характеристики по slug товара.
type Meta = { name: string; description: string; attributes: [string, string][] };
const META: Record<string, Meta> = {
  "dron-geprc-vapor-d5-dji-o4-pro-elrs-2-4": {
    name: "FPV-дрон GEPRC Vapor D5 (DJI O4 Pro, ELRS 2.4)",
    description: "Готовый 5-дюймовый FPV-дрон с цифровой видеосистемой DJI O4 Pro и приёмником ELRS 2.4 ГГц. Настроен и готов к полёту.",
    attributes: [["Класс", "5 дюймов"], ["Видеосистема", "DJI O4 Pro"], ["Управление", "ELRS 2.4 ГГц"]],
  },
  "dron-axisflying-manta-5se-v2-elrs-2-4": {
    name: "FPV-дрон Axisflying Manta 5SE V2 (ELRS 2.4)",
    description: "Лёгкий и манёвренный 5-дюймовый фристайл-дрон Axisflying Manta 5SE V2 с приёмником ELRS 2.4 ГГц.",
    attributes: [["Класс", "5 дюймов"], ["Управление", "ELRS 2.4 ГГц"]],
  },
  "dron-iflight-nazgul-xl5-eco-analog-pnp": {
    name: "FPV-дрон iFlight Nazgul XL5 ECO (аналог, PNP)",
    description: "5-дюймовый FPV-дрон iFlight Nazgul XL5 ECO с аналоговой видеосистемой. Поставляется в комплектации PNP — без аппаратуры и приёмника.",
    attributes: [["Класс", "5 дюймов"], ["Видеосистема", "Аналоговая"], ["Комплектация", "PNP"]],
  },
  "sinevup-geprc-cinelog-30-v3-dji-o4-pro-elrs-2-4": {
    name: "Cinewhoop GEPRC Cinelog 30 V3 (DJI O4 Pro, ELRS 2.4)",
    description: "Кинематографичный cinewhoop GEPRC Cinelog 30 V3 с цифровой видеосистемой DJI O4 Pro и приёмником ELRS 2.4 ГГц для плавной съёмки.",
    attributes: [["Тип", "Cinewhoop"], ["Видеосистема", "DJI O4 Pro"], ["Управление", "ELRS 2.4 ГГц"]],
  },
  "sinevup-betafpv-pavo-20-pro-ii": {
    name: "Cinewhoop BetaFPV Pavo 20 Pro (II)",
    description: "Компактный cinewhoop BetaFPV Pavo 20 Pro для съёмки в помещении и на улице.",
    attributes: [["Тип", "Cinewhoop"]],
  },
  "tinivup-happymodel-mobula-7-1s-elrs": {
    name: "Тинивуп HappyModel Mobula7 1S (ELRS)",
    description: "Популярный тинивуп HappyModel Mobula7 на 1S с приёмником ELRS. Отлично подходит для обучения и полётов дома.",
    attributes: [["Питание", "1S"], ["Управление", "ELRS"]],
  },
  "tinivup-happymodel-mobula-7-1s-hdzero": {
    name: "Тинивуп HappyModel Mobula7 1S (HDZero)",
    description: "Тинивуп HappyModel Mobula7 1S с цифровой HD-видеосистемой HDZero.",
    attributes: [["Питание", "1S"], ["Видеосистема", "HDZero"]],
  },
  "tinivup-betafpv-meteor-75-pro-o4-elrs": {
    name: "Тинивуп BetaFPV Meteor75 Pro O4 (ELRS)",
    description: "Тинивуп BetaFPV Meteor75 Pro с цифровой видеосистемой DJI O4 и приёмником ELRS.",
    attributes: [["Видеосистема", "DJI O4"], ["Управление", "ELRS"]],
  },
  "tinivup-betafpv-meteor-75-pro-elrs": {
    name: "Тинивуп BetaFPV Meteor75 Pro (ELRS)",
    description: "Лёгкий тинивуп BetaFPV Meteor75 Pro с приёмником ELRS для полётов в помещении.",
    attributes: [["Управление", "ELRS"]],
  },
  "apparatura-radiomaster-pocket-elrs": {
    name: "Аппаратура RadioMaster Pocket (ELRS)",
    description: "Компактная аппаратура управления RadioMaster Pocket со встроенным модулем ELRS.",
    attributes: [["Протокол", "ELRS"], ["Диапазон", "2.4 ГГц"]],
  },
  "apparatura-radiomaster-t8l-elrs": {
    name: "Аппаратура RadioMaster T8L (ELRS)",
    description: "Лёгкая аппаратура управления RadioMaster T8L с модулем ELRS.",
    attributes: [["Протокол", "ELRS"], ["Диапазон", "2.4 ГГц"]],
  },
  "apparatura-radiomaster-tx12-elrs": {
    name: "Аппаратура RadioMaster TX12 (ELRS)",
    description: "Аппаратура управления RadioMaster TX12 с модулем ELRS и полноразмерными стиками.",
    attributes: [["Протокол", "ELRS"], ["Диапазон", "2.4 ГГц"]],
  },
  "apparatura-radiomaster-tx15-elrs": {
    name: "Аппаратура RadioMaster TX15 (ELRS)",
    description: "Аппаратура управления RadioMaster TX15 с модулем ELRS.",
    attributes: [["Протокол", "ELRS"], ["Диапазон", "2.4 ГГц"]],
  },
  "shlem-betafpv-vr04-analog": {
    name: "FPV-очки BetaFPV VR04 (аналог)",
    description: "Бюджетные аналоговые FPV-очки BetaFPV VR04 — хороший вариант для начинающих.",
    attributes: [["Тип", "Аналоговые"]],
  },
  "shlem-dji-goggles-n3": {
    name: "FPV-очки DJI Goggles N3",
    description: "Цифровые FPV-очки DJI Goggles N3 с чётким изображением и низкой задержкой.",
    attributes: [["Тип", "Цифровые (DJI)"]],
  },
  "poletnyy-kontroller-matek-h743-slim-v4": {
    name: "Полётный контроллер Matek H743 Slim V4",
    description: "Мощный полётный контроллер Matek H743 Slim V4 на процессоре H743 для сложных сборок.",
    attributes: [["Процессор", "STM32 H743"], ["Форм-фактор", "30×30 мм"]],
  },
  "stek-speedybee-f405-v4-60a": {
    name: "Стек SpeedyBee F405 V4 (60A)",
    description: "Полётный стек SpeedyBee F405 V4: контроллер F405 и 4-в-1 ESC на 60A.",
    attributes: [["Контроллер", "F405"], ["ESC", "60A (4-в-1)"], ["Форм-фактор", "30×30 мм"]],
  },
  "akkumulyator-tattu-1s-300mah-hv-bt2-0": {
    name: "Аккумулятор Tattu 1S 300mAh (HV, BT2.0)",
    description: "Высоковольтный (LiHV) 1S аккумулятор Tattu 300mAh с разъёмом BT2.0 — для тинивупов.",
    attributes: [["Ёмкость", "300 mAh"], ["Банки", "1S"], ["Тип", "LiHV"], ["Разъём", "BT2.0"]],
  },
  "akkumulyator-gnb-1s-550mah-hv-ph2-0": {
    name: "Аккумулятор GNB 1S 550mAh (HV, PH2.0)",
    description: "Высоковольтный (LiHV) 1S аккумулятор GNB 550mAh с разъёмом PH2.0.",
    attributes: [["Ёмкость", "550 mAh"], ["Банки", "1S"], ["Тип", "LiHV"], ["Разъём", "PH2.0"]],
  },
  "akkumulyator-betafpv-1s-550mah-hv-bt2-0": {
    name: "Аккумулятор BetaFPV 1S 550mAh (HV, BT2.0)",
    description: "Высоковольтный (LiHV) 1S аккумулятор BetaFPV 550mAh с разъёмом BT2.0.",
    attributes: [["Ёмкость", "550 mAh"], ["Банки", "1S"], ["Тип", "LiHV"], ["Разъём", "BT2.0"]],
  },
  "akkumulyator-ovonic-6s-1300mah-xt60": {
    name: "Аккумулятор Ovonic 6S 1300mAh (XT60)",
    description: "6S аккумулятор Ovonic 1300mAh с разъёмом XT60 — для 5-дюймовых дронов.",
    attributes: [["Ёмкость", "1300 mAh"], ["Банки", "6S"], ["Разъём", "XT60"]],
  },
  "akkumulyator-ovonic-6s-1550mah-xt60": {
    name: "Аккумулятор Ovonic 6S 1550mAh (XT60)",
    description: "6S аккумулятор Ovonic 1550mAh с разъёмом XT60 — увеличенная ёмкость.",
    attributes: [["Ёмкость", "1550 mAh"], ["Банки", "6S"], ["Разъём", "XT60"]],
  },
};

// Цены (руб) по slug товара. 0/нет — цена не задана.
const PRICES: Record<string, number> = {
  "dron-geprc-vapor-d5-dji-o4-pro-elrs-2-4": 41680,
  "dron-axisflying-manta-5se-v2-elrs-2-4": 23300,
  "dron-iflight-nazgul-xl5-eco-analog-pnp": 20050,
  "sinevup-geprc-cinelog-30-v3-dji-o4-pro-elrs-2-4": 41680,
  "sinevup-betafpv-pavo-20-pro-ii": 11395,
  "tinivup-happymodel-mobula-7-1s-elrs": 11980,
  "tinivup-happymodel-mobula-7-1s-hdzero": 22200,
  "tinivup-betafpv-meteor-75-pro-o4-elrs": 19800,
  "tinivup-betafpv-meteor-75-pro-elrs": 11200,
  "apparatura-radiomaster-t8l-elrs": 3950,
  "apparatura-radiomaster-pocket-elrs": 6500,
  "apparatura-radiomaster-tx12-elrs": 10500,
  "apparatura-radiomaster-tx15-elrs": 13900,
  "shlem-betafpv-vr04-analog": 7940,
  "shlem-dji-goggles-n3": 24490,
  "stek-speedybee-f405-v4-60a": 7490,
  "poletnyy-kontroller-matek-h743-slim-v4": 10650,
  "akkumulyator-tattu-1s-300mah-hv-bt2-0": 300,
  "akkumulyator-gnb-1s-550mah-hv-ph2-0": 395,
  "akkumulyator-betafpv-1s-550mah-hv-bt2-0": 395,
  "akkumulyator-ovonic-6s-1300mah-xt60": 2010,
  "akkumulyator-ovonic-6s-1550mah-xt60": 2495,
};

// Соответствие: папка (trim) → категория
const CATEGORY_MAP: Record<string, { name: string; slug: string; description: string; sortOrder: number; featured?: boolean }> = {
  "Дроны": { name: "Дроны", slug: "drony", description: "Готовые FPV-дроны", sortOrder: 0, featured: true },
  "тинивупы": { name: "Тинивупы", slug: "tinivupy", description: "Микро-дроны для полётов в помещении", sortOrder: 1, featured: true },
  "Синевупы": { name: "Синивупы", slug: "sinivupy", description: "Cinewhoop для съёмки", sortOrder: 2, featured: true },
  "Аппаратуры управления": { name: "Аппаратура управления", slug: "apparatura", description: "Пульты и передатчики", sortOrder: 3 },
  "Очки и шлема": { name: "Очки и шлемы", slug: "ochki-i-shlemy", description: "FPV-очки и шлемы", sortOrder: 4 },
  "Аккамуляторы и зарядные устройства": { name: "Аккумуляторы и зарядные устройства", slug: "akkumulyatory", description: "Аккумуляторы и зарядки", sortOrder: 5 },
  "Полетные контроллеры и стеки": { name: "Полётные контроллеры и стеки", slug: "poletnye-kontrollery-i-steki", description: "Полётные контроллеры, стеки, ESC", sortOrder: 6 },
};

async function main() {
  console.log("🌱 Сидирование базы…");

  // --- Администратор ---
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@rst-aero.ru";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "admin12345";
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: "ADMIN" },
    create: { email: adminEmail, name: "Администратор", passwordHash: await bcrypt.hash(adminPassword, 10), role: "ADMIN" },
  });
  console.log(`✓ Админ: ${adminEmail} / ${adminPassword}`);

  // --- Способы доставки ---
  const deliveries = [
    { name: "Самовывоз", description: "Из пункта выдачи в вашем городе", priceKopecks: 0, requiresAddress: false, sortOrder: 0 },
    { name: "СДЭК", description: "Доставка курьером или в пункт выдачи", priceKopecks: 35000, requiresAddress: true, sortOrder: 1 },
    { name: "Почта России", description: "Доставка в любое отделение", priceKopecks: 25000, requiresAddress: true, sortOrder: 2 },
  ];
  for (const d of deliveries) {
    const existing = await prisma.deliveryMethod.findFirst({ where: { name: d.name } });
    if (existing) await prisma.deliveryMethod.update({ where: { id: existing.id }, data: d });
    else await prisma.deliveryMethod.create({ data: d });
  }
  console.log(`✓ Способы доставки: ${deliveries.length}`);

  // --- Инфостраницы ---
  const pages = [
    { key: "about", title: "О компании", body: "RST AERO SYSTEMS — магазин FPV-дронов, тинивупов, синивупов, запчастей и аппаратуры. Мы подбираем проверенное оборудование для пилотов любого уровня. Отправляем заказы по всей России." },
    { key: "delivery-payment", title: "Доставка и оплата", body: "Доставка: самовывоз, СДЭК и Почта России. Оплата онлайн картой или через СБП. После оформления заказа вы будете перенаправлены на защищённую страницу оплаты ЮKassa." },
    { key: "contacts", title: "Контакты", body: "Телефон: +7 (900) 000-00-00\nПочта: info@rst-aero.ru\nМы на связи ежедневно с 10:00 до 20:00 по МСК." },
  ];
  for (const p of pages) await prisma.siteContent.upsert({ where: { key: p.key }, update: p, create: p });
  console.log(`✓ Инфостраницы: ${pages.length}`);

  // --- Категории ---
  const catBySlug: Record<string, string> = {};
  for (const key of Object.keys(CATEGORY_MAP)) {
    const c = CATEGORY_MAP[key];
    const cat = await prisma.category.upsert({
      where: { slug: c.slug },
      update: { name: c.name, description: c.description, sortOrder: c.sortOrder },
      create: { name: c.name, slug: c.slug, description: c.description, sortOrder: c.sortOrder },
    });
    catBySlug[c.slug] = cat.id;
  }
  console.log(`✓ Категории: ${Object.keys(CATEGORY_MAP).length}`);

  // --- Товары из папки «каталог» ---
  // Чистим старые демо-товары и папку с публичными фото
  await prisma.product.deleteMany({});
  fs.rmSync(PUBLIC_DIR, { recursive: true, force: true });

  let total = 0;
  const folders = fs.readdirSync(CATALOG_DIR, { withFileTypes: true }).filter((e) => e.isDirectory());

  for (const folder of folders) {
    const map = CATEGORY_MAP[folder.name.normalize("NFC").trim()];
    if (!map) { console.warn(`⚠ Папка без категории: «${folder.name}»`); continue; }

    const srcDir = path.join(CATALOG_DIR, folder.name);
    const destDir = path.join(PUBLIC_DIR, map.slug);
    fs.mkdirSync(destDir, { recursive: true });

    const files = fs.readdirSync(srcDir).filter((f) => /\.(jpe?g|png)$/i.test(f));
    for (const file of files) {
      const name = cleanName(file);
      const baseSlug = slugify(name);
      const ext = file.split(".").pop()!.toLowerCase();
      const imageName = `${baseSlug}.${ext}`;

      // Копируем фото в public/products/<catSlug>/
      fs.copyFileSync(path.join(srcDir, file), path.join(destDir, imageName));
      const imageUrl = `/products/${map.slug}/${imageName}`;

      // Уникальный slug товара
      let slug = baseSlug;
      let n = 1;
      while (await prisma.product.findUnique({ where: { slug } })) { n++; slug = `${baseSlug}-${n}`; }

      const meta = META[baseSlug];
      const displayName = meta?.name ?? name;
      const attrsJson = meta?.attributes.length
        ? JSON.stringify(meta.attributes.map(([n, v]) => ({ name: n, value: v })))
        : null;

      await prisma.product.create({
        data: {
          name: displayName,
          slug,
          categoryId: catBySlug[map.slug],
          priceKopecks: (PRICES[baseSlug] ?? 0) * 100,
          stockQty: 10,
          isActive: true,
          isFeatured: Boolean(map.featured),
          description: meta?.description ?? null,
          attributes: attrsJson,
          images: { create: [{ url: imageUrl, alt: displayName, sortOrder: 0 }] },
        },
      });
      total++;
    }
    console.log(`  • ${map.name}: ${files.length} тов.`);
  }
  console.log(`✓ Товары: ${total}`);

  // Удаляем старые категории, которых нет в новом наборе (демо, напр. «Запчасти»)
  const keepSlugs = Object.values(CATEGORY_MAP).map((c) => c.slug);
  const removed = await prisma.category.deleteMany({ where: { slug: { notIn: keepSlugs } } });
  if (removed.count > 0) console.log(`✓ Удалено старых категорий: ${removed.count}`);

  console.log("✅ Готово.");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
