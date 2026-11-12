// Запускается один раз при старте сервера Next.js.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // Опрос статусов СДЭК — только на боевом сервере (не в dev и не на Vercel-заглушке).
  if (process.env.NODE_ENV !== "production" || process.env.VERCEL) return;
  if (process.env.CDEK_STATUS_POLLING === "off") return;
  const { startCdekStatusPolling } = await import("@/lib/cdek-sync");
  startCdekStatusPolling();
}
