'use client'
import { GetSalesWithPendingAmount } from '@/action/sales.action'
import { DataTable } from '@/components/custom/data-table'
import { Button } from '@/components/ui/button'
import { IconSend } from '@tabler/icons-react'
import { on } from 'events'
import React, { useEffect } from 'react'
import { PayPendingDialog } from './PayPendingButton'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type Props = {}

const columns = [
    {
        accessorKey: 'member_name',
        header: 'Member',
    },
    {
        accessorKey: 'member_phone',
        header: 'Phone',
    },
    {
        accessorKey: 'service_name',
        header: 'Service',
    },
    {
        accessorKey: 'due',
        header: 'Due',
    },
]


const PendingPayments = ({ }: Props) => {
    const [data, setData] = React.useState<any>()
    const [isLoading, setIsLoading] = React.useState(true)
    useEffect(() => {
        setIsLoading(true)
        const fetchData = async () => {
            try {
                const pendingPayments = (await GetSalesWithPendingAmount())
                setData(pendingPayments)
                setIsLoading(false)
            } catch (error) {
                console.error("Error fetching data:", error)
                setIsLoading(false)
            }
        }

        fetchData()
    }, [])

    const actions = [
        {
            accessorKey: 'id',
            header: 'Message',
            cellContent: <Button variant="destructive" className='cursor-pointer'><IconSend size={16} /></Button>,
            onClickGetRow: (row: any) => {
                // 63 is the Philippines. encodeURIComponent is required, not
                // cosmetic: the peso sign, the emoji, and any "&" in a member
                // or service name all corrupt the query string raw.
                const message = `Hi ${row.member_name}, your payment for ${row.service_name} of ₱${row.due} is due, thank you for choosing us. Stay healthy Stay strong.\n\n -Team CBG 💪🏻`
                window.open(`https://api.whatsapp.com/send?phone=63${row.member_phone}&text=${encodeURIComponent(message)}`)
            },
            // cellContentGetRow: (row: any) => <Button variant="secondary" className='cursor-pointer'><IconSend size={16} /></Button>,
        },
        {
            accessorKey: 'id',
            header: 'Pay',
            cellContent: <Button className='cursor-pointer'>Pay</Button>,
            cellContentGetRow: (row: any) => <PayPendingDialog sale_id={row.id} sale={row} onSuccess={() => window.location.reload()} />,
        }
    ]
    return (
            <Card>
                <CardHeader>
                    <CardTitle>Pending Payments</CardTitle>
                    <CardAction className="text-muted-foreground">Total Amount: ₱{(data?.total || 0)}</CardAction>
                </CardHeader>
                <CardContent>
                    <DataTable dataRows={data?.sales || []} isLoading={isLoading} columns={columns} actionColumns={actions} />

                </CardContent>
            </Card>
    )
}

export default PendingPayments