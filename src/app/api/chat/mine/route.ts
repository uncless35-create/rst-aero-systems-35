import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserConversation } from "@/lib/chat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Диалог вошедшего покупателя — чтобы виджет показал сообщения, начатые менеджером из заказа. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const conversation = await getUserConversation(session.user.id);
  if (!conversation) return NextResponse.json({ error: "Чата нет" }, { status: 404 });
  return NextResponse.json(conversation, { headers: { "Cache-Control": "no-store" } });
}
