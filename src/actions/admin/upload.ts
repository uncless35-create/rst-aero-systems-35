"use server";

import { assertAdmin } from "@/lib/admin";
import { isSupabaseConfigured, uploadProductImage } from "@/lib/supabase-storage";

export type UploadResult = { ok: true; url: string } | { ok: false; error: string };

export async function uploadImageAction(formData: FormData): Promise<UploadResult> {
  await assertAdmin();

  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      error: "Загрузка файлов недоступна: не подключён Supabase. Вставьте ссылку на изображение.",
    };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Файл не выбран" };
  }
  if (file.size > 5 * 1024 * 1024) {
    return { ok: false, error: "Файл больше 5 МБ" };
  }

  try {
    const url = await uploadProductImage(file);
    return { ok: true, url };
  } catch (e) {
    console.error("Ошибка загрузки в Supabase:", e);
    return { ok: false, error: "Не удалось загрузить изображение" };
  }
}
