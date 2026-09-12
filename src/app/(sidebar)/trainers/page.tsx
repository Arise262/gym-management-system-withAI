import Link from "next/link";
import { IconPlus } from "@tabler/icons-react";
import { GetAdminTrainers } from "@/action/trainer-admin.action";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { pesos } from "@/lib/format";
import { summariseHours } from "./_components/hours";

export const metadata = { title: "Trainers" };

export default async function TrainersPage() {
  const trainers = await GetAdminTrainers();
  const active = trainers.filter((t) => t.isActive);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">Trainers</h1>
          <p className="text-muted-foreground text-sm">
            {active.length} active · {active.filter((t) => t.isAvailable).length} taking bookings. Members book one-hour sessions inside each trainer&apos;s hours.
          </p>
        </div>
        <Button asChild>
          <Link href="/trainers/new">
            <IconPlus className="size-4" /> Add trainer
          </Link>
        </Button>
      </div>

      {trainers.length === 0 ? (
        <EmptyState title="No trainers yet" description="Add a trainer to let members book sessions with them." />
      ) : (
        <Card>
          <CardContent className="px-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Trainer</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead className="text-right">Upcoming</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trainers.map((t) => (
                    <TableRow key={t.id} className={t.isActive ? undefined : "opacity-60"}>
                      <TableCell>
                        <div className="font-medium">{t.name}</div>
                        <div className="text-muted-foreground text-xs">{t.email}</div>
                        {t.specializations.length > 0 && (
                          <div className="text-muted-foreground text-xs">{t.specializations.join(", ")}</div>
                        )}
                      </TableCell>
                      <TableCell className="max-w-64 text-sm whitespace-normal">{summariseHours(t.availability)}</TableCell>
                      <TableCell className="text-right tabular-nums">{pesos(t.hourlyRate)}</TableCell>
                      <TableCell className="text-right tabular-nums">{t.upcomingBookings}</TableCell>
                      <TableCell>
                        {!t.isActive ? (
                          <Badge variant="outline">Deactivated</Badge>
                        ) : t.isAvailable ? (
                          <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Taking bookings</Badge>
                        ) : (
                          <Badge className="bg-amber-400 text-black hover:bg-amber-400">Not bookable</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/trainers/${t.id}`}>Edit</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
