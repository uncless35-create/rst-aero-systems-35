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
- **react-hook-form + zod**, **sonner** (тосты). **pnpm**. Прод — **свой сервер в Москве** (Timeweb Cloud),
  см. «Прод-сервер» ниже; Vercel больше не основной хостинг.

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

**Админ:** `admin@rst-aero.ru`, пароль — `ADMIN_PASSWORD` из `.env` (сид требует ≥12 символов; старый `admin12345` недействителен).
После 5 неверных попыток вход по email блокируется на 15 минут с тем же текстом ошибки ([rate-limit.ts](src/lib/rate-limit.ts)).

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
- **Гостевые заказы** не видны в «Моих заказах», пока их не привяжут: страница заказа `/order/<accessToken>/success`
  ведёт на `/register|login?order=<accessToken>`, после входа [claimGuestOrder](src/actions/orders.ts) ставит `userId`.
  Право на заказ — только секретный `accessToken`; по email/телефону не привязываем (email не подтверждается).
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

## Прод-сервер

Сайт работает на VPS в Москве (`186.246.5.70`, Ubuntu 24.04), а не на Vercel: провайдеры РФ обрывали
соединения с Vercel после ~16 КБ. Конфиги сервера лежат в [deploy/](deploy/). SSH: `ssh -i ~/.ssh/rst_deploy root@186.246.5.70`.

- **Выкладка — push в `main`.** Раз в минуту `rst-deploy.timer` запускает [deploy.sh](deploy/deploy.sh).
  Скрипт клонирует коммит в `/srv/rst/releases/<sha>`, затем выполняет `pnpm install`, `prisma migrate deploy`
  и `pnpm build`, переключает симлинк `/srv/rst/current` и перезапускает `rst-web`. Если сайт после этого
  не отвечает, скрипт откатывает релиз и пишет владельцу в Telegram. Логи сборок — в `/srv/rst/logs/`,
  сайта — `journalctl -u rst-web`. Пересобрать вручную: `sudo -u rst /srv/rst/bin/deploy.sh --force`.
- **Настройки** — `/srv/rst/shared/.env` (симлинк в каждом релизе). `NEXT_PUBLIC_*` инлайнятся при сборке,
  поэтому после их правки нужна пересборка.
- **nginx** ([rst-aero.conf](deploy/nginx/rst-aero.conf)) — HTTPS (Let's Encrypt, `certbot.timer`) и редиректы
  `www`/`http` → `https://rst-aero.ru`.
- **БД — PostgreSQL 17 на сервере** (база и роль `rst`, доступ только с localhost; перенесена из Supabase
  04.11.2026). Каждую ночь делается копия в `/srv/rst/backups/` ([backup-db.sh](deploy/backup-db.sh),
  хранится 14 дней). **Локальный `.env` смотрит в Supabase — это уже не прод.** Скрипты против прода
  (сид, `content:apply`) запускать через туннель: `ssh -i ~/.ssh/rst_deploy -N -L 5433:localhost:5432 root@186.246.5.70`
  и `DATABASE_URL`/`DIRECT_URL` = `postgresql://rst:<пароль из /root/.rst-db-password>@localhost:5433/rst`.
- **Vercel** пока собирает каждый push, но домен на него не смотрит. Там все запросы переписываются
  на [pereezd.html](public/pereezd.html) (`rewrites` при `VERCEL=1` в [next.config.ts](next.config.ts)).
  Когда отвяжем домен от Vercel, удалить и заглушку, и rewrites.
- Вебхуки ЮKassa и Telegram смотрят на `https://rst-aero.ru/api/webhooks/*`. После смены домена
  или секрета выполнить `pnpm telegram:webhook` на сервере.

## Предпосылки вне кода

- **Боевые ключи ЮKassa** требуют регистрации ИП/самозанятости (бизнес-шаг; разработка — на тестовых ключах).
- Тексты **оферты/политики** готовит владелец (страница `/privacy` есть).
