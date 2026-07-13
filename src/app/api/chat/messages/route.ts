import { after, NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createCustomerChatMessage, getChatHistory } from "@/lib/chat";
import { consumeRateLimit } from "@/lib/rate-limit";
import {
  chatHistoryQuerySchema,
  customerChatMessageSchema,
} from "@/lib/validation/chat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clientIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export async function GET(request: NextRequest) {
  const parsed = chatHistoryQuerySchema.safeParse({
    token: request.nextUrl.searchParams.get("token"),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректный идентификатор чата" }, { status: 400 });
  }
  if (consumeRateLimit(`chat:get:${clientIp(request)}`, 120, 60_000)) {
    return NextResponse.json({ error: "Слишком много запросов" }, { status: 429 });
  }

  const history = await getChatHistory(parsed.data.token);
  if (!history) return NextResponse.json({ error: "Чат не найден" }, { status: 404 });
  return NextResponse.json(history, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  if (consumeRateLimit(`chat:post:${clientIp(request)}`, 12, 60_000)) {
    return NextResponse.json({ error: "Слишком много сообщений. Попробуйте через минуту." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = customerChatMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Проверьте сообщение" },
      { status: 400 },
    );
  }

  const session = await auth();
  const result = await createCustomerChatMessage(parsed.data, session?.user?.id, after);
  return NextResponse.json(result, { status: 201 });
}
