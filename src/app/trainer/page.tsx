import Link from "next/link";
import { IconMessage, IconUsers } from "@tabler/icons-react";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import LogoutButton from "@/components/custom/LogoutButton";
import { TrainerSchedule, type BookingRow } from "@/components/booking-lists";
import { requireRole } from "@/lib/session";
import { hasMailKey } from "@/lib/mail";
import { GetTrainerBookings } from "@/action/booking.action";
import { GetUnreadCount } from "@/action/notification.action";
import { GetTrainerClients } from "@/action/dashboard.action";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { NotificationBell } from "@/components/notification-bell";
import { AnnouncementForm } from "@/components/announcement-form";
import { StatGrid, StatTile } from "@/components/stat-tile";
import { EmptyState } from "@/components/empty-state";
import { gymToday } from "@/lib/format";

export default async function Page() {
  const user = await requireRole("TRAINER");
  const bookings = await GetTrainerBookings();
  const unread = await GetUnreadCount();
  const clients = await GetTrainerClients();

  const today = gymToday();
  const upcoming = bookings.filter((b) => !["COMPLETED", "CANCELLED", "NO_SHOW"].includes(b.status));
  const todayCount = bookings.filter((b) => b.date === today && b.status !== "CANCELLED").length;
  const pendingCount = bookings.filter((b) => b.status === "PENDING").length;

  const rows: BookingRow[] = bookings.map((b) => ({
    id: b.id,
    date: b.date,
    startTime: b.startTime,
    endTime: b.endTime,
    status: b.status,
    notes: b.notes,
    counterparty: b.member.name,
    // Member.phone is BigInt, which cannot cross into a client component —
    // it is not JSON-serialisable. Stringify at the boundary.
    counterpartyDetail: `${b.member.memberCode} · ${b.member.phone.toString()}`,
  }));

  return (
    <div className="bg-surface min-h-svh">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 p-4 pb-12">
        {/* Page header, not a card. The three figures below are the summary —
            wrapping them in a card as well just added a box around a box. */}
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-muted-foreground text-sm">Trainer</p>
            {/* SessionUser.name is nullable — an account with no name (an ADMIN
                viewing this page, say) would otherwise put a raw email address
                in 30px condensed display type. */}
            <h1 className="font-display truncate text-3xl leading-none font-semibold">
              {user.name ?? "Trainer area"}
            </h1>
            <p className="text-muted-foreground mt-1 truncate text-xs">{user.email}</p>
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell href="/trainer/notifications" unread={unread} />
            <Button asChild variant="outline" size="sm">
              <Link href="/trainer/messages">
                <IconMessage className="size-4" />
                Messages
              </Link>
            </Button>
          </div>
        </header>

        {/* pendingCount is the only figure that is a call to action, so it is the
            only one that carries a tone. */}
        <StatGrid className="md:grid-cols-3 xl:grid-cols-3">
          <StatTile
            label="Sessions today"
            value={todayCount}
            hint={todayCount === 0 ? "Nothing booked" : "On your schedule"}
          />
          <StatTile label="Open bookings" value={upcoming.length} hint="Upcoming, not yet done" />
          <StatTile
            label="Awaiting confirmation"
            value={pendingCount}
            hint={pendingCount === 0 ? "All caught up" : "Members waiting on you"}
            tone={pendingCount > 0 ? "warning" : "good"}
          />
        </StatGrid>

        <div>
          <h2 className="font-display text-xl font-semibold">Your schedule</h2>
          <p className="text-muted-foreground text-sm">Soonest first.</p>
        </div>

        <TrainerSchedule bookings={rows} />

        <Card>
          <CardHeader>
            <CardTitle>Your clients</CardTitle>
            <CardDescription>
              Everyone who has booked you or trains on a plan you own — the longest since a logged workout first.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {clients.length === 0 ? (
              <EmptyState
                icon={<IconUsers />}
                title="No clients yet"
                description="Members appear here once they book you or start training on a plan you own."
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Last workout</TableHead>
                      <TableHead className="text-right">Sessions this month</TableHead>
                      <TableHead className="text-right">Engagement</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clients.map((c) => (
                      <TableRow key={c.memberId}>
                        <TableCell>
                          <span className="font-medium">{c.name}</span>{" "}
                          <span className="text-muted-foreground">{c.memberCode}</span>
                        </TableCell>
                        <TableCell className="max-w-[14rem] truncate">{c.activePlan ?? <span className="text-muted-foreground">none</span>}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {c.daysSinceWorkout === null ? (
                            <span className="text-muted-foreground">never logged</span>
                          ) : c.daysSinceWorkout === 0 ? (
                            "today"
                          ) : (
                            <span className={c.daysSinceWorkout >= 7 ? "text-amber-700 dark:text-amber-400" : ""}>{c.daysSinceWorkout} days ago</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{c.sessionsThisMonth}</TableCell>
                        <TableCell className="text-right tabular-nums">{c.engagementScore ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <AnnouncementForm
          audience="members who have booked you or train on a plan you own"
          mailConfigured={hasMailKey()}
        />

        <div className="pt-2">
          <LogoutButton className="text-muted-foreground hover:text-destructive w-fit" />
        </div>
      </div>
    </div>
  );
}
