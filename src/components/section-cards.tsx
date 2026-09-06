"use client"

import { useEffect, useState } from "react"
import { IconTrendingDown, IconTrendingUp } from "@tabler/icons-react"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { getAllActiveMembers, GetAllMembers, MemberResponse } from "@/action/member.action"
import { GetSalesInCurrentMonth, GetSalesWithinLast7Days, SalesResponse } from "@/action/sales.action"

export  function SectionCards() {
  const [allMembers, setAllMembers] = useState<MemberResponse[]>([])
  const [activeMembers, setActiveMembers] = useState<MemberResponse[]>([])
  const [salesIn7Days, setSalesIn7Days] = useState<SalesResponse[]>([])
  const [salesInThisMonth, setSalesInThisMonth] = useState<SalesResponse[]>([])

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch all members
        const allMembersRes = (await GetAllMembers())
        setAllMembers(allMembersRes)

        // Fetch active members
        const activeMembersRes = await getAllActiveMembers()
        setActiveMembers(activeMembersRes)

        // Fetch sales in last 7 days
        const sales7DaysRes = await GetSalesWithinLast7Days()
        setSalesIn7Days(sales7DaysRes)

        // Fetch sales in current month
        const salesThisMonthRes = await GetSalesInCurrentMonth()
        setSalesInThisMonth(salesThisMonthRes)
      } catch (error) {
        console.error("Error fetching data:", error)
      }
    }

    fetchData()
  }, [])

  const last7DaysAmount = salesIn7Days.reduce((total, sale) => total + sale.amount - sale.discount, 0)
  const thisMonthAmount = salesInThisMonth.reduce((total, sale) => total + sale.amount - sale.discount, 0)

  return (
    <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-2 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>All Members</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {allMembers.length}
          </CardTitle>
        </CardHeader>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Active Members</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {activeMembers.length}
          </CardTitle>
        </CardHeader>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Sales in Last 7 Days</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            ₱{last7DaysAmount}
          </CardTitle>
          <CardDescription>Count: {salesIn7Days.length}</CardDescription>
        </CardHeader>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Sales in This Month</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            ₱{thisMonthAmount}
          </CardTitle>
          <CardDescription>Count: {salesInThisMonth.length}</CardDescription>
        </CardHeader>
      </Card>
    </div>
  )
}