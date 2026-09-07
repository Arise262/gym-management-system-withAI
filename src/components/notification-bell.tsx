import Link from "next/link";
import { IconBell } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";

/**
 * Bell with an unread badge. A server component: the count is fetched by the
 * page that renders it, so there is no client polling and nothing to secure
 * on the browser side.
 */
export function NotificationBell({ href, unread }: { href: string; unread: number }) {
  const label = unread === 0 ? "Notifications" : `Notifications, ${unread} unread`;
  return (
    <Link href={href} aria-label={label} className="relative inline-flex">
      <Button variant="outline" size="icon" type="button" tabIndex={-1}>
        <IconBell className="size-5" />
      </Button>
      {unread > 0 && (
        <span className="bg-red-600 text-white absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-semibold tabular-nums">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}
