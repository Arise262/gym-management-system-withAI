import Link from "next/link";
import { notFound } from "next/navigation";
import { IconArrowLeft } from "@tabler/icons-react";
import { GetAdminTrainer } from "@/action/trainer-admin.action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatAppDate, gymToday } from "@/lib/format";
import { AccountPanel } from "../_components/AccountPanel";
import { TrainerForm } from "../_components/TrainerForm";

export const metadata = { title: "Trainer" };

export default async function TrainerPage({ params }: { params: Promise<{ trainerId: string }> }) {
  const { trainerId } = await params;
  const trainer = await GetAdminTrainer(trainerId);
  if (!trainer) notFound();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4">
      <div className="flex flex-col gap-2">
        <Button variant="ghost" size="sm" asChild className="w-fit">
          <Link href="/trainers">
            <IconArrowLeft className="size-4" /> All trainers
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl font-semibold">{trainer.name}</h1>
          {!trainer.isActive ? (
            <Badge variant="outline">Deactivated</Badge>
          ) : !trainer.isAvailable ? (
            <Badge className="bg-amber-400 text-black hover:bg-amber-400">Not taking bookings</Badge>
          ) : null}
        </div>
      </div>

      {/* The key remounts the form after router.refresh(), so it shows what was saved. */}
      <TrainerForm key={JSON.stringify(trainer)} trainer={trainer} />

      <AccountPanel
        trainerId={trainer.id}
        name={trainer.name}
        email={trainer.email}
        isActive={trainer.isActive}
        // gymToday(), so a 7 am Manila sign-in is not dated yesterday by a UTC server.
        lastLogin={trainer.lastLoginAt ? (formatAppDate(gymToday(trainer.lastLoginAt)) ?? null) : null}
        upcomingBookings={trainer.upcomingBookings}
      />
    </div>
  );
}
