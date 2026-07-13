import { cn } from "@/lib/utils";

export function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={cn("size-5", className)}>
      <path d="M21.94 4.6 18.9 19.2c-.23 1.02-.84 1.27-1.7.79l-4.7-3.46-2.27 2.18c-.25.25-.46.46-.94.46l.33-4.78 8.7-7.86c.38-.34-.08-.53-.59-.19l-10.76 6.78-4.63-1.45c-1.01-.31-1.03-1 .21-1.49l18.1-6.98c.84-.31 1.57.2 1.3 1.41Z" />
    </svg>
  );
}
