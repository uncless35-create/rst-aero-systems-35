"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Loader2, MessageCircle, Send, X } from "lucide-react";
import { TelegramIcon } from "@/components/storefront/telegram-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { telegramBotUrl } from "@/lib/telegram-link";
import { cn } from "@/lib/utils";

const TOKEN_KEY = "rst-manager-chat-token";
const PROFILE_KEY = "rst-manager-chat-profile";
const OPEN_CHAT_EVENT = "rst:open-manager-chat";

type ChatMessage = {
  id: string;
  sender: "CUSTOMER" | "MANAGER";
  body: string;
  createdAt: string;
};

export function ManagerChat() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  // С токеном диалога бот подхватит переписку, начатую на сайте.
  const telegramUrl = telegramBotUrl(token);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setToken(window.localStorage.getItem(TOKEN_KEY));
      const savedProfile = window.localStorage.getItem(PROFILE_KEY);
      if (!savedProfile) return;
      try {
        const profile = JSON.parse(savedProfile) as { name?: string; contact?: string };
        setName(profile.name || "");
        setContact(profile.contact || "");
      } catch {
        window.localStorage.removeItem(PROFILE_KEY);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    function openFromProduct(event: Event) {
      const detail = (event as CustomEvent<{ draft?: string }>).detail;
      setOpen(true);
      if (detail?.draft) setDraft((current) => current || detail.draft || "");
    }
    window.addEventListener(OPEN_CHAT_EVENT, openFromProduct);
    return () => window.removeEventListener(OPEN_CHAT_EVENT, openFromProduct);
  }, []);

  const loadHistory = useCallback(async (conversationToken: string) => {
    const response = await fetch(
      `/api/chat/messages?token=${encodeURIComponent(conversationToken)}`,
      { cache: "no-store" },
    );
    if (response.status === 404) {
      window.localStorage.removeItem(TOKEN_KEY);
      setToken(null);
      setMessages([]);
      return;
    }
    if (!response.ok) return;
    const data = (await response.json()) as { messages: ChatMessage[] };
    setMessages(data.messages);
  }, []);

  useEffect(() => {
    if (!open || !token) return;
    const initialLoad = window.setTimeout(() => void loadHistory(token), 0);
    const timer = window.setInterval(() => void loadHistory(token), 5000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(timer);
    };
  }, [loadHistory, open, token]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    if (!draft.trim() || sending) return;
    setSending(true);
    setError("");

    const productSlug = pathname.startsWith("/product/")
      ? decodeURIComponent(pathname.slice("/product/".length).split("/")[0] || "")
      : undefined;

    try {
      const response = await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationToken: token || undefined,
          message: draft,
          customerName: name || undefined,
          customerContact: contact || undefined,
          pagePath: pathname,
          productSlug,
          privacyAccepted,
          website: "",
        }),
      });
      const data = (await response.json()) as {
        error?: string;
        conversationToken?: string;
        message?: ChatMessage;
      };
      if (!response.ok || !data.conversationToken || !data.message) {
        throw new Error(data.error || "Не удалось отправить сообщение");
      }

      window.localStorage.setItem(TOKEN_KEY, data.conversationToken);
      window.localStorage.setItem(PROFILE_KEY, JSON.stringify({ name, contact }));
      setToken(data.conversationToken);
      setMessages((current) =>
        current.some((message) => message.id === data.message?.id)
          ? current
          : [...current, data.message!],
      );
      setDraft("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Не удалось отправить сообщение");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {open ? (
        <section
          aria-label="Чат с менеджером"
          className="fixed inset-x-3 bottom-24 z-[70] flex max-h-[min(680px,calc(100dvh-7rem))] flex-col overflow-hidden rounded-3xl border border-border bg-background shadow-2xl md:inset-x-auto md:bottom-6 md:right-6 md:h-[620px] md:w-[390px]"
        >
          <header className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <h2 className="font-semibold">Задать вопрос</h2>
              <p className="text-xs text-muted-foreground">Менеджер ответит здесь и в рабочее время</p>
            </div>
            <Button type="button" variant="ghost" size="icon-sm" onClick={() => setOpen(false)} aria-label="Закрыть чат">
              <X className="size-5" />
            </Button>
          </header>

          {telegramUrl ? (
            <a
              href={telegramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 border-b border-border bg-surface px-5 py-3 text-sm transition-colors hover:bg-surface-2"
            >
              <TelegramIcon className="size-5 shrink-0 text-[#2AABEE]" />
              <span className="flex-1">
                <span className="font-medium">Написать менеджеру в Telegram</span>
                <span className="block text-xs text-muted-foreground">Ответим в мессенджере — не нужно держать вкладку открытой</span>
              </span>
              <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" />
            </a>
          ) : null}

          <div className="flex-1 space-y-3 overflow-y-auto bg-surface px-4 py-4">
            {messages.length === 0 ? (
              <div className="rounded-2xl bg-background p-4 text-sm leading-relaxed text-muted-foreground">
                Напишите о товаре, совместимости или доставке. Если вопрос относится к открытой карточке товара, мы автоматически увидим её название.
              </div>
            ) : null}
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                  message.sender === "CUSTOMER"
                    ? "ml-auto bg-primary text-primary-foreground"
                    : "bg-background text-foreground",
                )}
              >
                <p className="whitespace-pre-wrap break-words">{message.body}</p>
                <time className={cn("mt-1 block text-[10px]", message.sender === "CUSTOMER" ? "text-white/60" : "text-muted-foreground")}>
                  {new Date(message.createdAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                </time>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          <form onSubmit={sendMessage} className="space-y-3 border-t border-border p-4">
            {!token ? (
              <div className="grid grid-cols-2 gap-2">
                <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ваше имя" maxLength={80} />
                <Input value={contact} onChange={(event) => setContact(event.target.value)} placeholder="Телефон или @Telegram" maxLength={120} />
              </div>
            ) : null}
            <div className="flex items-end gap-2">
              <Textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Введите сообщение…"
                maxLength={2000}
                rows={2}
                className="min-h-12 resize-none"
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
              />
              <Button type="submit" size="icon" disabled={sending || !draft.trim() || !privacyAccepted} aria-label="Отправить сообщение">
                {sending ? <Loader2 className="size-5 animate-spin" /> : <Send className="size-5" />}
              </Button>
            </div>
            <label className="flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
              <input
                type="checkbox"
                checked={privacyAccepted}
                onChange={(event) => setPrivacyAccepted(event.target.checked)}
                className="mt-0.5 size-4 shrink-0 accent-primary"
              />
              <span>
                Отправляя сообщение, я соглашаюсь с обработкой данных и передачей текста менеджеру через Telegram согласно{" "}
                <Link href="/privacy" target="_blank" className="underline underline-offset-2">политике конфиденциальности</Link>.
              </span>
            </label>
            {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
            <p className="text-[11px] text-muted-foreground">Не отправляйте данные банковских карт и пароли.</p>
          </form>
        </section>
      ) : (
        <div className="fixed bottom-24 right-4 z-40 flex flex-col items-stretch gap-2 md:bottom-6 md:right-6">
          {telegramUrl ? (
            <Button asChild size="lg" className="gap-2 shadow-xl">
              <a
                href={telegramUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Написать менеджеру в Telegram"
              >
                <TelegramIcon className="size-5" />
                <span className="hidden sm:inline">Написать в Telegram</span>
              </a>
            </Button>
          ) : null}
          <Button
            type="button"
            size="lg"
            onClick={() => setOpen(true)}
            className="gap-2 shadow-xl"
            aria-label="Открыть чат с менеджером"
          >
            <MessageCircle className="size-5" />
            <span className="hidden sm:inline">Задать вопрос</span>
          </Button>
        </div>
      )}
    </>
  );
}
