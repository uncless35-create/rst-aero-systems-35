import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = "product-images";

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SERVICE_KEY);
}

function getServiceClient() {
  return createClient(SUPABASE_URL!, SERVICE_KEY!, {
    auth: { persistSession: false },
  });
}

/** Загружает файл в Supabase Storage и возвращает публичный URL. */
export async function uploadProductImage(file: File): Promise<string> {
  const client = getServiceClient();
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `products/${crypto.randomUUID()}.${ext}`;

  const { error } = await client.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || "image/jpeg",
    upsert: false,
  });
  if (error) throw error;

  const { data } = client.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
