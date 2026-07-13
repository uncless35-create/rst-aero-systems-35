# Database migrations

Fresh PostgreSQL databases can run `pnpm exec prisma migrate deploy` normally.

The current Supabase database predates Prisma Migrate and was created with
`prisma db push`. Before its first migration-based deployment, mark only the
baseline as applied, then deploy all later migrations:

```bash
pnpm exec prisma migrate resolve --applied 20260713110000_baseline
pnpm exec prisma migrate deploy
```

The deploy command applies both the order-safety migration and the product
content/chat migration. Run `pnpm content:check` before importing catalog text;
`pnpm content:apply` changes content fields only and preserves prices, stock,
images, and variants.

Do not run `migrate resolve` on a fresh database. Always back up production and
verify `DIRECT_URL` before applying migrations.
