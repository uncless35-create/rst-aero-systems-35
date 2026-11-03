/**
 * Структурированные данные schema.org для Яндекса и Google (цена и наличие в сниппете, хлебные крошки).
 * `<` экранируется, чтобы текст из базы не мог закрыть тег <script>.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

/** Абсолютный адрес страницы или файла сайта. */
export function absoluteUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return new URL(path, base).toString();
}

/** Копейки → цена для schema.org: 123450 → "1234.50". */
export function schemaPrice(kopecks: number): string {
  return (kopecks / 100).toFixed(2);
}
