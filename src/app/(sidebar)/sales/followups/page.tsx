'use client'
import { GetEnquiryByFollowupDate } from '@/action/enquiries.action'
import { getAllExpiringSalesInXDays, GetSalesEndingInXdays } from '@/action/sales.action'
import { DataTable } from '@/components/custom/data-table'
import { DatePickerDemo } from '@/components/custom/date-picker'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useLoading } from '@/hooks/use-loading'
import { format } from 'date-fns'
import Link from 'next/link'
import React, { useEffect, useState } from 'react'

type Props = {}

const columns = [
    {
        accessorKey: 'member_name',
        header: 'Name',
    },
    {
        accessorKey: 'endDate',
        header: 'End',
        cellClassName: 'capitalize',
    },
    {
        accessorKey: 'startDate',
        header: 'Start',
        cellClassName: 'capitalize',
    },
    {
        accessorKey: 'member_phone',
        header: 'Phone',
    },
    {
        accessorKey: 'service_name',
        header: 'Service',
    },
]
const page = (props: Props) => {
    const [salesList, setSalesList] = React.useState<any[]>([])
    const [days, setDays] = useState(0)
    const [SelectedSale, setSelectedSale] = useState<any>(null)
    const [message, setMessage] = useState('')
    const { showLoading, hideLoading, isLoading } = useLoading()
    useEffect(() => {
        showLoading()
        fetchData()
    }, [])
    useEffect(() => {
        showLoading()
        fetchData()
    }, [days])

    async function fetchData() {
        if (days === -1) {
            const data = await GetSalesEndingInXdays(-1)
            setSalesList(data)
            hideLoading()
            return
        } else {
            const data = await getAllExpiringSalesInXDays(days)
            setSalesList(data)
            hideLoading()
            return
        }
        // console.log(await GetSalesEndingInXdays(-1))
    }

    const handleSaleSelected = (row: any) => {
        setSelectedSale(row);
        const msgexpired = `Hi👋🏻 ${row.member_name} your ${row.service_name} membership has ended on ${(row.endDate)}, Please renew your membership.%0A%0A-Team CBG 💪🏻`
        const msg7days = `Hi👋🏻 ${row.member_name} your ${row.service_name} membership is ending in 7 days (on ${(row.endDate)}), Please renew your membership.%0A%0A-Team CBG 💪🏻`
        const msg5days = `Hi👋🏻 ${row.member_name} your ${row.service_name} membership is ending in 5 days (on ${(row.endDate)}), Please renew your membership.%0A%0A-Team CBG 💪🏻`
        const msgtoday = `Hi👋🏻 ${row.member_name} your ${row.service_name} membership is ending today (on ${(row.endDate)}), Please renew your membership.%0A%0A-Team CBG 💪🏻`
        const msgtomorrow = `Hi👋🏻 ${row.member_name} your ${row.service_name} membership is ending tomorrow (on ${(row.endDate)}), Please renew your membership.%0A%0A-Team CBG 💪🏻`
        if (days === -1) {
            setMessage(msgexpired)
        } else if (days === 7) {
            setMessage(msg7days)
        } else if (days === 5) {
            setMessage(msg5days)
        } else if (days === 0) {
            setMessage(msgtoday)
        } else if (days === 1) {
            setMessage(msgtomorrow)
        }
    }

    return (
        <div className='max-w-xl w-full mx-auto space-y-6 p-4'>
            <div className='flex items-center justify-between'>
                <h1 className='text-xl font-semibold'>Membership Followups</h1>
            </div>
            <Separator />
            <Card>
                <CardHeader>
                    <CardTitle>Send message</CardTitle>
                    <CardDescription>Send message to selected member</CardDescription>
                </CardHeader>
                {
                    SelectedSale &&
                    <CardContent className='space-y-4'>
                        <p>{message}</p>
                        <Link className='text-primary mt-4' href={`https://api.whatsapp.com/send?phone=63${SelectedSale?.member_phone}&text=${encodeURIComponent(message)}`} target='_blank'>
                            <Button>
                                Send
                            </Button>
                        </Link>
                    </CardContent>
                }

            </Card>
            <Tabs onValueChange={(e) => setDays(parseInt(e))} defaultValue='0'>
                <TabsList >
                    <TabsTrigger value='0'>Today</TabsTrigger>
                    <TabsTrigger value='1'>Tomorrow</TabsTrigger>
                    <TabsTrigger value='5'>5 days</TabsTrigger>
                    <TabsTrigger value='7'>7 days</TabsTrigger>
                    <TabsTrigger value='-1'>Expired</TabsTrigger>
                </TabsList>
            </Tabs>
            <DataTable dataRows={salesList} isLoading={isLoading} columns={columns} onItemClick={handleSaleSelected} />
        </div>
    )
}

export default page

// https://api.whatsapp.com/send?phone=639171234567&text=Hello%20%0ABrother