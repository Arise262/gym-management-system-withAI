import { GetNotificationOverview } from "@/action/notification.action";
import { NotificationAdmin } from "@/components/notification-admin";
import { AnnouncementForm } from "@/components/announcement-form";

export const metadata = { title: "Notifications" };

/**
 * Admin notifications page.
 *
 * Role guard lives in GetNotificationOverview (requireRole("ADMIN")), the
 * same pattern as /retention, and middleware.ts default-denies this path to
 * anyone who is not an admin anyway.
 */
export default async function NotificationsAdminPage() {
  const overview = await GetNotificationOverview();

  return (
    <div className="flex flex-col gap-4 px-4 lg:px-6">
      <div>
        <h1 className="text-2xl font-semibold">Notifications</h1>
        <p className="text-muted-foreground text-sm">
          Automated reminders and alerts, plus announcements to every member.
        </p>
      </div>
      <NotificationAdmin overview={overview} />
      <AnnouncementForm audience="every member with an account" mailConfigured={overview.mailConfigured} />
    </div>
  );
}
