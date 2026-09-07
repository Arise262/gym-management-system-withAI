import Link from "next/link";
import { IconArrowLeft } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { NotificationList } from "@/components/notification-list";
import { GetMyNotifications } from "@/action/notification.action";
import { requireRole } from "@/lib/session";

export const metadata = { title: "Notifications" };

export default async function TrainerNotificationsPage() {
  await requireRole("TRAINER");
  const items = await GetMyNotifications();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4">
      <Link href="/trainer">
        <Button variant="ghost" size="sm" className="-ml-2">
          <IconArrowLeft className="mr-1 size-4" />
          Back
        </Button>
      </Link>
      <h1 className="text-2xl font-semibold">Notifications</h1>
      <NotificationList
        items={items}
        emptyText="Nothing yet. New booking requests and cancellations from your members will show up here."
      />
    </div>
  );
}
