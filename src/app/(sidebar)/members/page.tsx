"use client";
import {
  GetAllMembers,
  getAllMembersWithActiveSale,
  getAllActiveMembers,
  getAllInActiveMembers,
  updateReviewStatus,
} from "@/action/member.action";
// import { getAllActiveMembers } from '@/action/sales.action'
import { DataTable } from "@/components/custom/data-table";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLoading } from "@/hooks/use-loading";
import { Check, Cross, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useEffect } from "react";
import { toast } from "sonner";

type Props = {};
const columns = [
  {
    accessorKey: "name",
    header: "Name",
  },
  {
    accessorKey: "phone",
    header: "Phone",
  },
  {
    accessorKey: "activeServiceName",
    header: "Active Service",
    cellClassName: "capitalize",
  },
  {
    accessorKey: "age",
    header: "Age",
  },
];

const MemberPage = (props: Props) => {
  const router = useRouter();
  const [memberList, setMemberList] = React.useState<any[]>([]);
  const [value, setValue] = React.useState<string>("");
  // const [isLoading, setIsLoading] = React.useState<boolean>(false)
  const { showLoading, hideLoading, isLoading } = useLoading();
  useEffect(() => {
    async function fetchData() {
      const data = await getAllMembersWithActiveSale();
      // console.log(await getAllActiveMembers())
      setMemberList(data);
      hideLoading();
    }
    showLoading();
    fetchData();
  }, []);
  useEffect(() => {
    // Skip the initial render. `value` starts as "", which matches none of the
    // branches below, so this effect used to race the mount effect above: it
    // fired at the same time and fell straight through to hideLoading() while
    // that first fetch was still in flight. The table then flashed its empty
    // state before the members arrived. The tab handler owns this effect; the
    // first load belongs to the effect above.
    if (!value) return;

    async function fetchData() {
      if (value === "0") {
        const data = await getAllMembersWithActiveSale();
        setMemberList(data);
        hideLoading();
        return;
      } else if (value === "1") {
        const data = await getAllActiveMembers();
        setMemberList(data);
        hideLoading();
        return;
      } else if (value === "2") {
        const data = await getAllInActiveMembers();
        setMemberList(data);
        hideLoading();
        return;
      }
      hideLoading();
    }
    showLoading();
    fetchData();
  }, [value]);
  const actionColumn = [
    {
      accessorKey: "id",
      header: "Review",
      // cellContent: <Button size={"sm"} variant={"secondary"} className='cursor-pointer'><IconFile /></Button>,
      cellContentGetRow: (row: any) => (
        <ReviewButton id={row.id} isDone={row.reviewDone} />
      ),
    },
  ];
  return (
    <div className="max-w-xl w-full mx-auto space-y-6 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Members</h1>
        <Link href={"/members/new"}>
          <Button>Create Member</Button>
        </Link>
      </div>
      <Separator />
      <Tabs onValueChange={(e) => setValue(e)} defaultValue="0">
        <TabsList>
          <TabsTrigger value="0">All</TabsTrigger>
          <TabsTrigger value="1">Active</TabsTrigger>
          <TabsTrigger value="2">In active</TabsTrigger>
        </TabsList>
      </Tabs>
      <DataTable
        dataRows={memberList}
        isLoading={isLoading}
        columns={columns}
        onItemClick={(row) => router.push(`/members/${row.id}`)}
        actionColumns={actionColumn}
      />
    </div>
  );
};

export default MemberPage;

const ReviewButton = ({ id, isDone }: { id: string; isDone: boolean }) => {
  const [isTick, setIsTick] = React.useState(isDone);
  const [loading, setLoading] = React.useState(false);
  const updateReview = async (status: boolean) => {
    setLoading(true);
    const res = await updateReviewStatus(id, status);
    if (res.success) {
      setIsTick(status);
      setLoading(false);
      return;
    } else {
      toast.error("Failed to update review");
      setLoading(false);
      return;
    }
  };
  if (!isTick) {
    return (
      <Button
        size={"icon"}
        variant={"destructive"}
        className="cursor-pointer"
        onClick={() => updateReview(true)}
      >
        {!loading ? (
          <X size={16} className="" />
        ) : (
          <div className="animate-spin rounded-full h-4 w-4 border-l-2 border-b-2 border-white"></div>
        )}
      </Button>
    );
  } else {
    return (
      <Button
        size={"icon"}
        variant={"default"}
        className="cursor-pointer"
        onClick={() => updateReview(false)}
      >
        {!loading ? (
          <Check size={16} />
        ) : (
          <div className="animate-spin rounded-full h-4 w-4 border-l-2 border-b-2 border-white"></div>
        )}
        
      </Button>
    );
  }
};
