'use client'
import { GetAllMembers } from '@/action/member.action'
import { DeleteServiceById, GetAllServices, ServiceResponse } from '@/action/service.action'
import { DataTable } from '@/components/custom/data-table'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useLoading } from '@/hooks/use-loading'
import { IconTrash } from '@tabler/icons-react'
import Link from 'next/link'
import React, { useEffect } from 'react'
import { toast } from 'sonner'
import { formatDuration } from '@/lib/duration'

type Props = {}
const columns = [
  {
    accessorKey: 'name',
    header: 'Name',
  },
  {
    accessorKey: 'description',
    header: 'Description',
  },
  {
    accessorKey: 'price',
    header: 'Price',
  },
  {
    // "7" alone could be months or days now that both exist.
    accessorKey: 'durationLabel',
    header: 'Duration',
  }
]

const DeleteColumn = [{
  accessorKey: 'id',
  header: 'Action',
  cellContent: <Button variant="destructive" size={"icon"} className='cursor-pointer'><IconTrash size={16} /></Button>,
  onClick: async (rowId: any) => {
    const result = await DeleteServiceById(rowId)
    toast.success("Service deleted successfully")
  }
}]

const MemberPage = (props: Props) => {
  const [serviceList, setServiceList] = React.useState<ServiceResponse[]>([])
  const { showLoading, hideLoading, isLoading } = useLoading()
  useEffect(() => {
    async function fetchData() {
      const data = await GetAllServices()
      setServiceList(data.map((s) => ({ ...s, durationLabel: formatDuration(s.duration, s.durationUnit) })))
      hideLoading()
    }
    showLoading()
    fetchData()

  }, [])

  return (
    <div className='max-w-xl w-full mx-auto space-y-6 p-4'>
      <div className='flex items-center justify-between'>
        <h1 className='text-xl font-semibold'>Services</h1>
        <Link href={'/services/new'}>
          <Button>Create Service</Button>
        </Link>
      </div>
      <Separator />
      <DataTable dataRows={serviceList} columns={columns}
        // actionColumns={DeleteColumn}
        isLoading={isLoading} />
    </div>
  )
}

export default MemberPage