# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**RST AERO SYSTEMS** — интернет-магазин FPV-дронов, тинивупов, запчастей и аппаратуры. Весь UI на
русском (`lang="ru"`). Категории: Дроны, Тинивупы, Запчасти, Аппаратура. Дизайн — минимализм по
референсу (светлая тема, крупные скругления, графитовые кнопки, акцент electric lime), mobile-first
с нижней навигацией, плавные анимации (Framer Motion).

## Стек (фактический)

- **Next.js 16 (App Router) + TypeScript**, `src/` dir, Turbopack.
- **Tailwind CSS v4** (конфиг через `@theme` в [globals.css](src/app/globals.css), без `tailwind.config`).
- **Собственный UI-kit** в [src/components/ui/](src/components/ui/) поверх Radix primitives
  (`@radix-ui/react-slot|label|dialog|switch`) + `class-variance-authority`. shadcn CLI не используется.
- **Framer Motion** — пакет `motion`, импорт из `motion/react`.
- **Prisma 6** (НЕ 7 — v7 требует driver-адаптеры; намеренно откатились ради простоты).
- **БД: SQLite локально** ([prisma/dev.db](prisma/), `provider = "sqlite"`), **PostgreSQL (Supabase) в проде**.
  Схема переносимая: статусы и JSON хранятся строками — работает на обоих провайдерах.
- **Auth.js v5** (`next-auth@beta`) Credentials + JWT, роли `CUSTOMER`/`ADMIN`, пароли `bcryptjs`.
- **ЮKassa** REST API v3 (карты + СБП) через `fetch`; при отсутствии ключей — деградирует (заказ без онлайн-оплаты).
- **Supabase Storage** для фото товаров (bucket `product-images`); без него фото добавляются ссылкой.
- **Zustand + persist** — корзина и избранное (клиентские, localStorage).
- **react-hook-form + zod**, **sonner** (тосты). **pnpm**. Деплой — **Vercel**.

## Окружение и команды

Node установлен через **nvm** (`~/.nvm`). В неинтерактивном шелле подгружайте его:
`export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"` — затем `pnpm ...`.

- `pnpm dev` — дев-сервер (http://localhost:3000)
- `pnpm build` — прод-сборка (`prisma generate && next build`); `pnpm start` — прод-запуск
- `pnpm lint` — ESLint
- `pnpm db:push` — применить схему к БД (dev, без миграций)
- `pnpm db:seed` — сид (категории, ~12 товаров, админ, доставка, страницы)
- `pnpm db:reset` — пересоздать БД + сид
- `pnpm db:studio` — Prisma Studio

**Билд-скрипты pnpm:** нативные пакеты (prisma, esbuild, sharp, unrs-resolver) разрешены через
`allowBuilds:` в [pnpm-workspace.yaml](pnpm-workspace.yaml). При добавлении нативной зависимости
пропишите её там в `true`, иначе `pnpm install` завершится кодом 1 и `prisma generate` упадёт.

**Админ (dev):** `admin@rst-aero.ru` / `admin12345` (из сида, задаётся `ADMIN_EMAIL`/`ADMIN_PASSWORD`).

## Архитектура (неочевидное)

- **Деньги — целые копейки** (`priceKopecks`, `totalKopecks`, …). Формат — [src/lib/money.ts](src/lib/money.ts). Не хранить рубли во float.
- **Статусы — строки** с русскими подписями/константами в [src/lib/constants.ts](src/lib/constants.ts)
  (`OrderStatus`, `PaymentStatus`). Характеристики товара — JSON-строка в `Product.attributes` (`parseAttributes`).
- **`orderNumber` вычисляется** как `max+1` (старт 1000) в транзакции ([src/actions/checkout.ts](src/actions/checkout.ts)),
  а не `autoincrement` — ради совместимости со SQLite.
- **Цены/остатки заказа считаются на сервере** из БД, данным клиента не доверяем. `OrderItem` хранит
  снимок `productName`/`variantName`/`priceKopecks`. Остатки списываются в транзакции.
- **Все мутации — Server Actions** в [src/actions/](src/actions/) (админские — под `admin/`, каждая вызывает `assertAdmin()`).
- **Auth split:** [auth.config.ts](src/lib/auth.config.ts) (edge-safe, без Prisma — для middleware) +
  [auth.ts](src/lib/auth.ts) (Node, Credentials+Prisma). [middleware.ts](src/middleware.ts) защищает
  `/admin/*` (роль ADMIN) и `/account/*`. ⚠️ Next 16 предупреждает, что `middleware`→`proxy` (пока работает).
- **ЮKassa** ([src/lib/yookassa.ts](src/lib/yookassa.ts)): `createPayment`/`getPayment`. Вебхук
  [api/webhooks/yookassa](src/app/api/webhooks/yookassa/route.ts) **перепроверяет платёж по id**, идемпотентен,
  на обработанные случаи всегда 200. Если ключей нет — заказ оформляется без оплаты.
- **Чат с менеджером** ([src/lib/chat.ts](src/lib/chat.ts)) — один `ChatConversation` на покупателя,
  два входа: виджет на сайте и бот `@rst_aero_bot` (логин — `SITE.telegramBot`, переопределяется
  `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`). Сообщения покупателя уходят владельцу карточкой в Telegram;
  **ответ = реплай на эту карточку** (мэппинг по `ChatMessage.telegramMessageId`) либо ответ из админки.
  Диалогу с `telegramUserChatId` ответ доставляется в бот покупателю, остальным — в виджет.
  Ссылка из виджета несёт `?start=<publicToken>`, поэтому переписка, начатая на сайте, продолжается
  в Telegram тем же диалогом. Вебхук [api/webhooks/telegram](src/app/api/webhooks/telegram/route.ts)
  различает чат владельца (`TELEGRAM_CHAT_ID`) и покупателей, идемпотентен по `update_id`.
- **Prisma singleton** — [src/lib/prisma.ts](src/lib/prisma.ts).
- **Хранилища клиента** — [src/stores/](src/stores/); чтобы не рассинхронить SSR, компоненты со счётчиками
  используют [useHydrated()](src/lib/use-hydrated.ts).

## Раскладка роутов

- `src/app/(storefront)/` — витрина: `/`, `catalog`, `catalog/[categorySlug]`, `product/[slug]`, `cart`,
  `favorites`, `checkout`, `order/[orderNumber]/success`, `account/*`, `login`, `register`,
  `about`/`delivery-payment`/`contacts` (из `SiteContent`), `privacy`.
- `src/app/admin/` — `login` (вне chrome) + `(panel)/*` (guard-layout + сайдбар): `dashboard`,
  `products` (+`new`, `[id]/edit`), `categories`, `delivery-methods`, `orders` (+`[id]`), `pages`.
- `src/app/api/` — `auth/[...nextauth]`, `webhooks/yookassa`.

## Переход на Supabase/Postgres (прод)

1. Создать проект Supabase → строки подключения; в [schema.prisma](prisma/schema.prisma) сменить
   `provider = "postgresql"`, добавить `directUrl = env("DIRECT_URL")`; выставить `DATABASE_URL`
   (пул, 6543, `?pgbouncer=true`) и `DIRECT_URL` (5432). Создать bucket `product-images` (public).
2. `prisma migrate dev` (сгенерировать первую Postgres-миграцию) → `pnpm db:seed`.
3. Заполнить env: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `YOOKASSA_SHOP_ID/SECRET_KEY`,
   `NEXTAUTH_SECRET` (`openssl rand -base64 32`), `NEXTAUTH_URL`, `NEXT_PUBLIC_SITE_URL`.
4. Vercel: импортировать репо, задать те же env; билд `prisma generate && prisma migrate deploy && next build`.
5. Зарегистрировать прод-URL вебхука в кабинете ЮKassa: `https://<домен>/api/webhooks/yookassa`.

## Предпосылки вне кода

- **Боевые ключи ЮKassa** требуют регистрации ИП/самозанятости (бизнес-шаг; разработка — на тестовых ключах).
- Тексты **оферты/политики** готовит владелец (страница `/privacy` есть).
