import Link from "next/link";
import { IconMessage } from "@tabler/icons-react";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
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

export default async function Page() {
  const user = await requireRole("TRAINER");
  const bookings = await GetTrainerBookings();
  const unread = await GetUnreadCount();
  const clients = await GetTrainerClients();

  const today = format(new Date(), "dd-MM-yyyy");
  const upcoming = bookings.filter((b) => !["COMPLETED", "CANCELLED", "NO_SHOW"].includes(b.status));

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
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle>Trainer area</CardTitle>
              <CardDescription>
                Signed in as <span className="text-foreground">{user.email}</span>.
              </CardDescription>
            </div>
            <NotificationBell href="/trainer/notifications" unread={unread} />
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex gap-6">
            <div>
              <div className="text-2xl font-semibold tabular-nums">
                {bookings.filter((b) => b.date === today && b.status !== "CANCELLED").length}
              </div>
              <p className="text-muted-foreground text-xs">Sessions today</p>
            </div>
            <div>
              <div className="text-2xl font-semibold tabular-nums">{upcoming.length}</div>
              <p className="text-muted-foreground text-xs">Open bookings</p>
            </div>
            <div>
              <div className="text-2xl font-semibold tabular-nums">
                {bookings.filter((b) => b.status === "PENDING").length}
              </div>
              <p className="text-muted-foreground text-xs">Awaiting your confirmation</p>
            </div>
          </div>
          <Separator />
          <div className="flex items-center gap-2">
            <Link href="/trainer/messages">
              <Button variant="outline" size="sm">
                <IconMessage className="mr-1 size-4" />
                Messages
              </Button>
            </Link>
            <LogoutButton className="w-fit text-red-500" />
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-lg font-semibold">Your schedule</h2>
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
            <p className="text-muted-foreground text-sm">No clients yet. They appear here once a member books you.</p>
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
    </div>
  );
}
