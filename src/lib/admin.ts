import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

/** Гарантирует, что текущий пользователь — администратор. Иначе редирект/ошибка. */
export async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/admin/login");
  }
  return session;
}

/** Для server actions: бросает ошибку, если не админ (без редиректа). */
export async function assertAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Доступ запрещён");
  }
  return session;
}
