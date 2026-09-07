"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { NotificationType } from "@prisma/client";
import {
  IconAlertTriangle,
  IconBarbell,
  IconBell,
  IconCalendarCheck,
  IconCalendarX,
  IconCalendarQuestion,
  IconChecks,
  IconCreditCard,
  IconMail,
  IconSparkles,
  IconSpeakerphone,
  IconTrendingUp,
} from "@tabler/icons-react";
import {
  MarkAllNotificationsRead,
  MarkNotificationRead,
  type NotificationItem,
} from "@/action/notification.action";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * The notifications panel shared by members and trainers.
 *
 * Opening a notification marks it read and follows its link. Read state is
 * server-side (Notification.readAt) so it survives devices and sign-outs, and
 * so the engagement analytics can later ask "who actually reads these".
 */

const ICON: Record<NotificationType, React.ComponentType<{ className?: string }>> = {
  WORKOUT_REMINDER: IconBarbell,
  MEMBERSHIP_RENEWAL: IconCreditCard,
  PROGRESS_UPDATE: IconTrendingUp,
  MOTIVATIONAL: IconSparkles,
  TRAINER_ANNOUNCEMENT: IconSpeakerphone,
  BOOKING_CONFIRMED: IconCalendarCheck,
  BOOKING_REQUESTED: IconCalendarQuestion,
  BOOKING_CANCELLED: IconCalendarX,
  PAYMENT_RECEIVED: IconCreditCard,
  RETENTION_ALERT: IconAlertTriangle,
};

const TONE: Partial<Record<NotificationType, string>> = {
  MEMBERSHIP_RENEWAL: "text-amber-600",
  RETENTION_ALERT: "text-red-600",
  BOOKING_CANCELLED: "text-red-600",
  PAYMENT_RECEIVED: "text-emerald-600",
  BOOKING_CONFIRMED: "text-emerald-600",
};

export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d} d ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export function NotificationList({
  items,
  emptyText = "Nothing yet. Reminders, confirmations and updates will show up here.",
}: {
  items: NotificationItem[];
  emptyText?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  // Optimistic read marks so the row greys out immediately.
  const [readIds, setReadIds] = React.useState<Set<string>>(() => new Set());

  const unread = items.filter((n) => !n.readAt && !readIds.has(n.id)).length;

  function open(n: NotificationItem) {
    if (!n.readAt) {
      setReadIds((s) => new Set(s).add(n.id));
      startTransition(async () => {
        await MarkNotificationRead(n.id);
        if (!n.actionUrl) router.refresh();
      });
    }
    if (n.actionUrl) router.push(n.actionUrl);
  }

  function markAll() {
    setReadIds(new Set(items.map((n) => n.id)));
    startTransition(async () => {
      await MarkAllNotificationsRead();
      router.refresh();
    });
  }

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="text-muted-foreground flex items-center gap-3 py-8 text-sm">
          <IconBell className="size-5" />
          {emptyText}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          {unread === 0 ? "All caught up." : `${unread} unread`}
        </p>
        <Button variant="ghost" size="sm" onClick={markAll} disabled={pending || unread === 0}>
          <IconChecks className="mr-1 size-4" />
          Mark all read
        </Button>
      </div>

      <ul className="flex flex-col gap-2">
        {items.map((n) => {
          const Icon = ICON[n.type] ?? IconBell;
          const isRead = Boolean(n.readAt) || readIds.has(n.id);
          return (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => open(n)}
                className={cn(
                  "hover:bg-accent/60 flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                  isRead ? "bg-background" : "bg-accent/30 border-foreground/20"
                )}
              >
                <span className={cn("mt-0.5 shrink-0", TONE[n.type] ?? "text-muted-foreground")}>
                  <Icon className="size-5" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex items-center gap-2">
                    <span className={cn("truncate text-sm", isRead ? "font-medium" : "font-semibold")}>
                      {n.title}
                    </span>
                    {!isRead && <span className="bg-foreground size-1.5 shrink-0 rounded-full" />}
                  </span>
                  <span className="text-muted-foreground line-clamp-3 text-sm whitespace-pre-line">{n.body}</span>
                  <span className="text-muted-foreground mt-1 flex items-center gap-2 text-xs">
                    {timeAgo(n.createdAt)}
                    {n.sentAt && (
                      <span className="inline-flex items-center gap-1">
                        <IconMail className="size-3" /> emailed
                      </span>
                    )}
                    {n.actionUrl && <span className="underline-offset-2 hover:underline">Open</span>}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
