import { prisma } from "@/lib/prisma";
import { OpenChatButton } from "@/components/storefront/open-chat-button";

/** Плашка в личном кабинете: менеджер написал покупателю, а тот ещё не прочитал. */
export async function ManagerMessageNotice({ userId }: { userId: string }) {
  const unread = await prisma.chatMessage.count({
    where: { sender: "MANAGER", readAt: null, conversation: { is: { userId } } },
  });
  if (unread === 0) return null;

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-primary bg-surface p-5 text-sm">
      <p className="font-medium">
        {unread === 1 ? "У вас новое сообщение от менеджера" : `У вас ${unread} новых сообщения от менеджера`}
      </p>
      <OpenChatButton />
    </div>
  );
}
