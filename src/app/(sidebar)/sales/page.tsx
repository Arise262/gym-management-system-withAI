'use client'
import { GetAllMembers } from '@/action/member.action'
import { DeleteSaleById, GetAllSalesWithExpand, SalesResponse } from '@/action/sales.action'
import { DataTable } from '@/components/custom/data-table'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useLoading } from '@/hooks/use-loading'
import { IconFile, IconSend, IconTrash } from '@tabler/icons-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React, { useEffect } from 'react'
import { toast } from 'sonner'

type Props = {}
const columns = [
  {
    accessorKey: 'service_name',
    header: 'Service Name',
  },
  {
    accessorKey: 'member_name',
    header: 'Member Name',
  },
  {
    accessorKey: 'startDate',
    header: 'Start',
    cellClassName: 'capitalize',
  },
  {
    accessorKey: 'endDate',
    header: 'End',
    cellClassName: 'capitalize',
  },
  {
    accessorKey: 'dueAmount',
    header: 'Due',
  },
]

const SalesPage = (props: Props) => {
  const [salesList, setSalesList] = React.useState<SalesResponse[]>([])
  const { showLoading, hideLoading, isLoading } = useLoading()
  const router = useRouter()
  useEffect(() => {
    async function fetchData() {
      const data = await GetAllSalesWithExpand()
      setSalesList(data)
      hideLoading()
    }
    showLoading()
    fetchData()
  }, [])

  const DeleteColumn = [
    {
      accessorKey: 'id',
      header: 'Delete',
      cellContent: <Button variant="destructive" className='cursor-pointer'><IconTrash size={16} /></Button>,
      onClick: async (rowId: any) => {
        const result = await DeleteSaleById(rowId)
        toast.success("Sales deleted successfully")
        window.location.reload()
      },

    },
    {
      accessorKey: 'id',
      header: 'Invoice',
      cellContent: <Button size={"sm"} variant={"secondary"} className='cursor-pointer'><IconFile /></Button>,
      onClick: async (rowId: any) => {
        router.push(`/invoices/${rowId}`)
      },

    },
    {
      accessorKey: 'id',
      header: 'Send',
      cellContent: <Button size={"sm"} variant={"secondary"} className='cursor-pointer'><IconSend /></Button>,

      onClickGetRow: (row: any) => {
        console.log(row)
        const message = `Hi ${row.member_name}, your invoice for ${row.service_name} is attached with this message, thank you for choosing us. Stay healthy Stay strong. 

https://gym-prisma.vercel.app/invoices/${row.id} 

 -Team CBG 💪🏻`
        // 63 is the Philippines; encodeURIComponent so the emoji, newlines and
        // any "&" in a member or service name survive the query string.
        window.open(`https://api.whatsapp.com/send?phone=63${row.member.phone}&text=${encodeURIComponent(message)}`)
      }

    }
  ]
  return (
    <div className='max-w-xl w-full mx-auto space-y-6 p-4'>
      <div className='flex items-center justify-between'>
        <h1 className='text-xl font-semibold'>Sales</h1>
        <div className='flex gap-2'>
          <Link href={'/sales/collections'}>
            <Button variant='outline'>Daily collections</Button>
          </Link>
          <Link href={'/sales/new'}>
            <Button>Create Sales</Button>
          </Link>
        </div>
      </div>
      <Separator />
      <DataTable dataRows={salesList} actionColumns={DeleteColumn} columns={columns} isLoading={isLoading} />
    </div>
  )
}

export default SalesPage