import Link from "next/link";
import { IconArrowLeft, IconCalendarEvent } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GetTrainers } from "@/action/booking.action";

const DAY_LABEL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function TrainersPage() {
  const trainers = await GetTrainers();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <Link href="/member">
          <Button variant="ghost" size="sm" className="-ml-2">
            <IconArrowLeft className="mr-1 size-4" />
            Back
          </Button>
        </Link>
        <Link href="/member/bookings">
          <Button variant="ghost" size="sm">
            <IconCalendarEvent className="mr-1 size-4" />
            My bookings
          </Button>
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-semibold">Book a trainer</h1>
        <p className="text-muted-foreground text-sm">
          One-hour personal training sessions.
        </p>
      </div>

      {trainers.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No trainers available</CardTitle>
            <CardDescription>
              Nobody is taking bookings at the moment. Please check back later.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        trainers.map((t) => {
          const days = [...new Set(t.availability.map((a) => a.dayOfWeek))].sort();
          return (
            <Card key={t.id}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle>{t.name}</CardTitle>
                    <CardDescription>₱{t.hourlyRate.toLocaleString()} per hour</CardDescription>
                  </div>
                  <Link href={`/member/trainers/${t.id}`}>
                    <Button size="sm">Book</Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {t.bio && <p className="text-muted-foreground text-sm">{t.bio}</p>}

                {t.specializations.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {t.specializations.map((s) => (
                      <Badge key={s} variant="secondary" className="capitalize">{s}</Badge>
                    ))}
                  </div>
                )}

                <p className="text-muted-foreground text-sm">
                  {days.length > 0
                    ? `Trains ${days.map((d) => DAY_LABEL[d]).join(", ")}`
                    : "No availability set yet"}
                </p>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
