import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import React from 'react'

type Props = {
    attendance: any[]
}

const AttendanceSum = ({
    attendance = []
}: Props) => {
  return (
    <Card className=''>
        <CardHeader>
            <CardTitle>
                Attendance
            </CardTitle>
        </CardHeader>
        <CardContent>

        <div className='max-h-[300px] overflow-y-auto'>
        <Table>
        <TableHeader>
            <TableRow>
                <TableHead>Sr.</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Time</TableHead>
            </TableRow>
        </TableHeader>

        <TableBody>
            {
                attendance.length > 0  ? attendance.map((item: any, index: number) => (
                    <TableRow key={index}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell>{item.date}</TableCell>
                        <TableCell>{item.time}</TableCell>
                    </TableRow>
                )) : 
                <TableRow>
                    <TableCell className='col-span-3'>
                    <p className='text-center p-4 border border-dashed rounded-md col-span-3'>No attendance record found</p>
                    </TableCell>
                </TableRow>
            }
            
        </TableBody>
        </Table>
        </div>
        </CardContent>

    </Card>
  )
}

export default AttendanceSum