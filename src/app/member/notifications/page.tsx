import Link from "next/link";
import { IconArrowLeft } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { NotificationList } from "@/components/notification-list";
import { GetMyNotifications } from "@/action/notification.action";

export const metadata = { title: "Notifications" };

export default async function MemberNotificationsPage() {
  const items = await GetMyNotifications();

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4 p-4">
      <Link href="/member">
        <Button variant="ghost" size="sm" className="-ml-2">
          <IconArrowLeft className="mr-1 size-4" />
          Back
        </Button>
      </Link>
      <h1 className="text-2xl font-semibold">Notifications</h1>
      <NotificationList items={items} />
    </div>
  );
}
