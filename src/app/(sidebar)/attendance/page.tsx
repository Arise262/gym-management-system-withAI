"use client";
import { AddAttendance, GetAttendanceByDate } from "@/action/attendance.action";
import { GetAllMembers } from "@/action/member.action";
import ItemSelector from "@/components/custom/item-selector";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useLoading } from "@/hooks/use-loading";
import { IconClock } from "@tabler/icons-react";
import { format, set } from "date-fns";
import { Clock } from "lucide-react";
import Link from "next/link";
import React, { useEffect } from "react";
import { toast } from "sonner";
import { gymToday } from "@/lib/format";

type Props = {};

const page = (props: Props) => {
  const { showLoading, hideLoading } = useLoading();
  const [memberList, setMemberList] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const [selectedMember, setSelectedMember] = React.useState<string>();
  const [attendanceList, setAttendanceList] = React.useState<any[]>([]);
  const [refresh, setRefresh] = React.useState<boolean>(false);
  useEffect(() => {
    async function fetchData() {
      const data = await GetAllMembers();
      setMemberList(data);
    }
    fetchData();
    fetchTodaysAttendance();
  }, []);
  useEffect(() => {
    async function fetchData() {
      await fetchTodaysAttendance();
    }
    fetchData();
  }, [refresh]);
  async function fetchTodaysAttendance() {
    const data = await GetAttendanceByDate(gymToday());
    console.log(data);
    setAttendanceList(data);
  }
  const handleCheckIn = async () => {
    showLoading();
    setRefresh(!refresh);
    if (!selectedMember) return;
    const newAttendance = {
      member_id: selectedMember,
      date: gymToday(),
      time: format(new Date(), "HH:mm:ss"),
    };
    const data = await AddAttendance(newAttendance);
    if (data.id) {
      toast.success("Attendance added successfully");
    }
    hideLoading();
  };

  function convertToAmPm(timeStr: string) {
    const [hour, minute, sec] = timeStr.split(":");
    let h = parseInt(hour);
    const ampm = h >= 12 ? "pm" : "am";
    h = h % 12 || 12; // convert 0 to 12
    return `${h.toString().padStart(2, "0")}:${minute} ${ampm}`;
  }
  return (
    <div className="max-w-xl w-full mx-auto space-y-6 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Attendance</h1>
        <Link href="/attendance/history">
          <Button className="gap-2" variant="outline">
            <IconClock size={16} /> History
          </Button>
        </Link>
      </div>
      <Separator />
      <div className="flex items-center justify-between gap-4">
        <ItemSelector
          data={memberList}
          valueKey="id"
          labelKey="name"
          onSelect={(id) => setSelectedMember(id)}
          placeholder="Select Member"
          searchPlaceholder="Search Member"
        />
        <Button onClick={handleCheckIn} disabled={!selectedMember}>
          Check In
        </Button>
      </div>
      <Separator />
      <Card>
        <CardHeader>
          <CardTitle>
            <h2 className="text-xl font-semibold">Today's Attendance</h2>
          </CardTitle>
        </CardHeader>
          <CardContent >
            <div className="">
              {attendanceList.length === 0 ? (
                <p className="text-muted-foreground flex items-center justify-center border-dashed border-2 border-muted rounded-md p-2 py-8">
                  No attendance records found
                </p>
              ) : (
                attendanceList.map((attendance, index) => (
                  <div
                    key={attendance.id}
                    className="flex gap-4 hover:bg-muted rounded-md p-2"
                  >
                    <p>{index + 1}</p>
                    <p>{attendance.member.name}</p>
                    <p className="ml-auto">
                      {attendance.time && convertToAmPm(attendance.time)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
      </Card>
    </div>
  );
};

export default page;
