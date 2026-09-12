import Link from "next/link";
import { addDays, format, parse } from "date-fns";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { GetDailyCollections } from "@/action/collections.action";
import { StatGrid, StatTile } from "@/components/stat-tile";
import { EmptyState } from "@/components/empty-state";
import { PaidBadge, PassBadge } from "@/components/paid-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatAppDate, formatClock, gymToday, pesos, toAppDate } from "@/lib/format";
import { WALK_IN_RATES } from "@/lib/walk-in";

export const metadata = { title: "Daily collections" };

/**
 * What came in on one gym day, split by where the money is: the cash drawer
 * (walk-ins + membership cash at the desk) and PayMongo (online). A server
 * page — the date lives in the URL, so a day can be bookmarked or shared, and
 * the date picker is a plain GET form that needs no client JavaScript.
 */
export default async function CollectionsPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const sp = await searchParams;
  const today = gymToday();
  const day = toAppDate(sp.date) ?? today;
  const d = await GetDailyCollections(day);
  const t = d.totals;

  const parsed = parse(day, "dd-MM-yyyy", new Date());
  const prev = format(addDays(parsed, -1), "dd-MM-yyyy");
  const next = format(addDays(parsed, 1), "dd-MM-yyyy");
  const isToday = day === today;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Daily collections</h1>
          <p className="text-muted-foreground text-sm">
            {isToday ? "Today, " : ""}
            {formatAppDate(day, "EEEE d MMMM yyyy")} — walk-ins and membership payments.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="icon" asChild>
            <Link href={`/sales/collections?date=${prev}`} aria-label="Previous day">
              <IconChevronLeft className="size-4" />
            </Link>
          </Button>
          {!isToday && (
            <Button variant="outline" asChild>
              <Link href="/sales/collections">Today</Link>
            </Button>
          )}
          {!isToday && (
            <Button variant="outline" size="icon" asChild>
              <Link href={`/sales/collections?date=${next}`} aria-label="Next day">
                <IconChevronRight className="size-4" />
              </Link>
            </Button>
          )}
          <form className="flex items-center gap-2" action="/sales/collections">
            <label htmlFor="collections-date" className="sr-only">
              Pick a day
            </label>
            <Input id="collections-date" type="date" name="date" defaultValue={format(parsed, "yyyy-MM-dd")} className="w-auto" />
            <Button type="submit" variant="secondary">
              Go
            </Button>
          </form>
        </div>
      </div>

      <StatGrid className="xl:grid-cols-4">
        <StatTile label="Cash in the drawer" value={pesos(t.cashInDrawer)} hint={`${pesos(t.walkInCash)} walk-ins · ${pesos(t.membershipCash)} memberships`} />
        <StatTile
          label="Walk-ins"
          value={d.walkIns.length}
          hint={[
            `${t.walkInsPaid} paid`,
            t.passesSold > 0 ? `${t.passesSold} weekly ${t.passesSold === 1 ? "pass" : "passes"} sold` : null,
            t.walkInsCovered > 0 ? `${t.walkInsCovered} on a pass` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        />
        <StatTile
          label="Unpaid walk-ins"
          value={pesos(t.unpaidAmount)}
          hint={t.walkInsUnpaid === 0 ? "Nobody owes for today" : `${t.walkInsUnpaid} still to pay — mark them on Attendance`}
          tone={t.walkInsUnpaid > 0 ? "warning" : undefined}
        />
        <StatTile label="Paid online" value={pesos(t.online)} hint={`${pesos(t.collected)} collected in total`} />
      </StatGrid>

      <Card>
        <CardHeader>
          <CardTitle>Walk-ins</CardTitle>
          <CardDescription>
            {WALK_IN_RATES.STUDENT.label} {pesos(WALK_IN_RATES.STUDENT.price)} · {WALK_IN_RATES.REGULAR.label.toLowerCase()}{" "}
            {pesos(WALK_IN_RATES.REGULAR.price)} per session, or {pesos(WALK_IN_RATES.WEEKLY.price)} for a 7-day pass — its later
            visits are covered and cost nothing. Recorded on the Attendance page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {d.walkIns.length === 0 ? (
            <EmptyState title="No walk-ins this day" />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Rate</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.walkIns.map((w) => (
                    <TableRow key={w.id}>
                      <TableCell className="text-muted-foreground tabular-nums">{formatClock(w.time)}</TableCell>
                      <TableCell className="font-medium">{w.name}</TableCell>
                      <TableCell>
                        {w.covered ? "Visit on weekly pass" : WALK_IN_RATES[w.rate].label}
                        {w.validUntil && <span className="text-muted-foreground text-xs"> · until {formatAppDate(w.validUntil)}</span>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{w.covered ? "—" : pesos(w.amount)}</TableCell>
                      <TableCell>{w.covered ? <PassBadge /> : <PaidBadge paid={w.paid} />}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Membership payments</CardTitle>
          <CardDescription>
            Cash taken at the desk and online payments settled this day. Balances still owed are on{" "}
            <Link href="/sales/pending-payments" className="underline underline-offset-2">
              Pending payments
            </Link>
            .
          </CardDescription>
        </CardHeader>
        <CardContent>
          {d.payments.length === 0 ? (
            <EmptyState title="No membership payments this day" />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Member</TableHead>
                    <TableHead>For</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-muted-foreground tabular-nums">{formatClock(p.time)}</TableCell>
                      <TableCell>
                        <span className="font-medium">{p.member}</span> <span className="text-muted-foreground text-xs">{p.memberCode}</span>
                      </TableCell>
                      <TableCell>{p.service ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={p.cash ? "secondary" : "outline"} className="capitalize">
                          {p.cash ? "Cash" : p.method.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{pesos(p.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
