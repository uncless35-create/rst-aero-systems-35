"use client";

import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Открывает виджет «Задать вопрос» (ManagerChat слушает это событие). */
export function OpenChatButton({ label = "Открыть чат" }: { label?: string }) {
  return (
    <Button
      size="sm"
      className="gap-2"
      onClick={() => window.dispatchEvent(new CustomEvent("rst:open-manager-chat"))}
    >
      <MessageCircle className="size-4" />
      {label}
    </Button>
  );
}
