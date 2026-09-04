import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import React from 'react'

type Props = {
  activeSales: any[]
  expiredSales: any[]
}

const Sales = ({
  activeSales,
  expiredSales
}: Props) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Memberships</CardTitle>
      </CardHeader>
      <CardContent>
        <p className='mb-2 text-lg font-semibold'>Active Membership</p>
        {
          activeSales?.length > 0 ? activeSales.map((sale: any) => {
            return (
              <div key={sale.id} className='flex justify-between hover:bg-muted p-2 rounded-md'>
                <p>{sale.service.name}</p>
                <p>{sale.startDate} - {sale.endDate}</p>
              </div>
            )
          }) : <p className='text-center p-4 border border-dashed rounded-md'>No Active Membership</p>
        }
        <Separator className='my-4'/>
        <p className='mb-2 text-lg font-semibold'>Expired Membership</p>
        {
          expiredSales?.length > 0 ? expiredSales.map((sale: any) => {
            return (
              <div key={sale.id} className='flex justify-betweelgn hover:bg-muted p-2 rounded-md'>
                <p>{sale.service.name}</p>
                <p>{sale.startDate} - {sale.endDate}</p>
              </div>
            )
          }) : <p className='text-center p-4 border border-dashed rounded-md'>No Expired Membership</p>
        }
      </CardContent>
    </Card>
  )
}

export default Sales