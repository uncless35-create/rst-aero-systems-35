# Repository Guidelines

## Project Structure & Module Organization

This Russian-language FPV store uses Next.js 16, React 19, and TypeScript. Routes live in `src/app/`: `(storefront)` contains customer pages, `admin` the management UI, and `api` the Auth.js, payment, and CDEK endpoints. Put server mutations in `src/actions/`, reusable UI in `src/components/`, shared logic in `src/lib/`, and Zustand state in `src/stores/`. Prisma files are under `prisma/`; served assets belong in `public/`. The root `каталог/` holds source product media used by the seed script.

## Build, Test, and Development Commands

- `pnpm install` installs the locked dependencies (pnpm 11.9.0; Node.js >= 20.9).
- `pnpm dev` starts Turbopack development at `http://localhost:3000`.
- `pnpm lint` runs ESLint with Next.js Core Web Vitals and TypeScript rules.
- `pnpm test` runs the Vitest unit suite once.
- `pnpm build` generates the Prisma client and creates the production build.
- `pnpm start` serves a completed production build.
- `pnpm db:push` applies the Prisma schema to the configured database.
- `pnpm db:migrate` applies committed PostgreSQL migrations.
- `pnpm db:studio` opens Prisma Studio.

`pnpm db:seed` deletes and rebuilds the product catalog, recopies `public/products`, and initializes stock at zero; use it only against an intended development database. An existing catalog additionally requires `ALLOW_DESTRUCTIVE_SEED=true`. `pnpm db:reset` is destructive.

## Coding Style & Naming Conventions

Use strict TypeScript, two-space indentation, semicolons, and double quotes. Name components and exported types in PascalCase, variables and functions in camelCase, and files in kebab-case. Prefer the `@/` import alias. Keep Server Components as the default; add `"use client"` only for browser state or interactivity. Store money as integer kopecks. Reuse `src/components/ui/` primitives and Tailwind theme tokens from `src/app/globals.css`.

## Testing Guidelines

Vitest covers critical server logic; colocate tests under `__tests__/` as `*.test.ts` or `*.test.tsx`. No coverage threshold is configured. Before submitting, run `pnpm test`, `pnpm lint`, and `pnpm build`, then manually exercise affected storefront and admin routes, including mobile layouts.

## Commit & Pull Request Guidelines

Recent commits use concise Russian, feature-scoped subjects such as `Оплата: ...` or `Обложки категорий: ...`. Keep commits focused. Pull requests should describe behavior, database or environment impacts, and manual verification. Link issues and include before/after screenshots for UI work.

## Security & Configuration

Copy `.env.example` locally, but never commit `.env*` or credentials. The current Prisma schema uses PostgreSQL and requires both `DATABASE_URL` and `DIRECT_URL`. Treat payment, Supabase service-role, CDEK, Telegram, and Auth.js secrets as server-only; only expose variables intentionally prefixed with `NEXT_PUBLIC_`.
