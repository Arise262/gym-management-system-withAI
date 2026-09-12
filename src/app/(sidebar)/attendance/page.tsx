"use client";
import { AddAttendance, GetAttendanceByDate } from "@/action/attendance.action";
import { GetAllMembers } from "@/action/member.action";
import { GetActiveWalkInPasses, GetWalkInsByDate, type ActivePass, type WalkInRow } from "@/action/walk-in.action";
import ItemSelector from "@/components/custom/item-selector";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { IconCash, IconClock } from "@tabler/icons-react";
import { format } from "date-fns";
import Link from "next/link";
import React, { useEffect } from "react";
import { toast } from "sonner";
import { gymToday } from "@/lib/format";
import { AttendanceList, type MemberCheckIn } from "./_components/AttendanceList";
import { WalkInForm } from "./_components/WalkInForm";

const page = () => {
  const [memberList, setMemberList] = React.useState<any[]>([]);
  const [selectedMember, setSelectedMember] = React.useState<string>();
  const [checkIns, setCheckIns] = React.useState<MemberCheckIn[]>([]);
  const [walkIns, setWalkIns] = React.useState<WalkInRow[]>([]);
  const [passes, setPasses] = React.useState<ActivePass[]>([]);
  const [checkingIn, setCheckingIn] = React.useState(false);

  useEffect(() => {
    GetAllMembers().then(setMemberList);
    refresh();
  }, []);

  async function refresh() {
    const day = gymToday();
    // Sequential, not Promise.all: the pooler runs one connection, so these
    // would queue anyway.
    setCheckIns(await GetAttendanceByDate(day));
    setWalkIns(await GetWalkInsByDate(day));
    setPasses(await GetActiveWalkInPasses());
  }

  const refreshPasses = async () => setPasses(await GetActiveWalkInPasses());

  // A pass holder checked in twice gets the visit already on file back, so
  // replace by id rather than always prepending.
  function upsertWalkIn(w: WalkInRow) {
    setWalkIns((list) => (list.some((x) => x.id === w.id) ? list.map((x) => (x.id === w.id ? w : x)) : [w, ...list]));
    // Selling a pass or using one changes the pass-holder list.
    if (w.rate === "WEEKLY") refreshPasses();
  }

  // The old handler refreshed the list BEFORE the check-in was written, so the
  // new name only appeared on the next visit, and it returned early with the
  // loading overlay still up when no member was selected.
  const handleCheckIn = async () => {
    if (!selectedMember) return;
    setCheckingIn(true);
    try {
      const already = checkIns.some((a) => a.member.id === selectedMember);
      await AddAttendance({ member_id: selectedMember, date: gymToday(), time: format(new Date(), "HH:mm:ss") });
      toast.success(already ? "Already checked in today" : "Checked in");
      await refresh();
    } catch {
      toast.error("Could not check that member in.");
    } finally {
      setCheckingIn(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">Attendance</h1>
          <p className="text-muted-foreground text-sm">Check in a member, or a walk-in paying per session.</p>
        </div>
        <div className="flex gap-2">
          <Button className="gap-2" variant="outline" asChild>
            <Link href="/sales/collections">
              <IconCash size={16} /> Collections
            </Link>
          </Button>
          <Button className="gap-2" variant="outline" asChild>
            <Link href="/attendance/history">
              <IconClock size={16} /> History
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardContent>
          <Tabs defaultValue="member">
            <TabsList className="mb-4">
              <TabsTrigger value="member">Member</TabsTrigger>
              <TabsTrigger value="walkin">Walk-in</TabsTrigger>
            </TabsList>
            <TabsContent value="member">
              <div className="flex flex-wrap items-center gap-3">
                <ItemSelector
                  data={memberList}
                  valueKey="id"
                  labelKey="name"
                  onSelect={(id) => setSelectedMember(id)}
                  placeholder="Select member"
                  searchPlaceholder="Search member"
                />
                <Button onClick={handleCheckIn} disabled={!selectedMember || checkingIn}>
                  {checkingIn ? "Checking in…" : "Check in"}
                </Button>
              </div>
            </TabsContent>
            <TabsContent value="walkin">
              <WalkInForm passes={passes} onAdded={upsertWalkIn} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Today&apos;s attendance</CardTitle>
          <CardDescription>Newest first. Mark a walk-in paid when they hand over the cash.</CardDescription>
        </CardHeader>
        <CardContent>
          <AttendanceList
            checkIns={checkIns}
            walkIns={walkIns}
            onWalkInChange={upsertWalkIn}
            onWalkInRemoved={(id) => {
              setWalkIns((list) => list.filter((x) => x.id !== id));
              refreshPasses();
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default page;
