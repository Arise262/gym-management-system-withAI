'use client'
import { GetAttendanceByDate } from '@/action/attendance.action'
import { GetWalkInsByDate, type WalkInRow } from '@/action/walk-in.action'
import { DatePickerDemo } from '@/components/custom/date-picker'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { formatAppDate, gymToday } from '@/lib/format'
import React, { useEffect, useState } from 'react'
import { AttendanceList, type MemberCheckIn } from '../_components/AttendanceList'

const page = () => {
    // gymToday(), not the browser's date, so the default day matches the one
    // check-ins are filed under.
    const [date, setDate] = useState(gymToday())
    const [checkIns, setCheckIns] = React.useState<MemberCheckIn[]>([])
    const [walkIns, setWalkIns] = React.useState<WalkInRow[]>([])

    useEffect(() => {
        let stale = false
        async function fetchData() {
            const members = await GetAttendanceByDate(date)
            const guests = await GetWalkInsByDate(date)
            // A quick second pick must not be overwritten by the first reply.
            if (stale) return
            setCheckIns(members)
            setWalkIns(guests)
        }
        fetchData()
        return () => { stale = true }
    }, [date])

    return (
        <div className='mx-auto w-full max-w-2xl space-y-6 p-4'>
            <h1 className='font-display text-3xl font-semibold'>Attendance history</h1>
            <Separator />
            <DatePickerDemo defaultDate={date} onDateChange={(d) => setDate(d)} />
            <Card>
                <CardHeader>
                    <CardTitle>{formatAppDate(date, 'EEEE d MMMM yyyy') ?? date}</CardTitle>
                </CardHeader>
                <CardContent>
                    <AttendanceList
                        checkIns={checkIns}
                        walkIns={walkIns}
                        emptyTitle="No one checked in this day"
                        onWalkInChange={(w) => setWalkIns((list) => list.map((x) => (x.id === w.id ? w : x)))}
                        onWalkInRemoved={(id) => setWalkIns((list) => list.filter((x) => x.id !== id))}
                    />
                </CardContent>
            </Card>
        </div>
    )
}

export default page
