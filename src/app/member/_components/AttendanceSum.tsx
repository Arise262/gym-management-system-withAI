import { CalendarX } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EmptyState } from '@/components/empty-state'
import { formatAppDate } from '@/lib/format'

type Props = {
    attendance: any[]
}

const AttendanceSum = ({ attendance = [] }: Props) => {
    const hasRows = attendance.length > 0

    return (
        <Card>
            <CardHeader>
                <CardTitle className='text-base'>Recent check-ins</CardTitle>
            </CardHeader>
            <CardContent>
                {/* The empty state sits outside the table entirely. It used to be a
                    dashed box inside a single <TableCell> carrying `col-span-3` — a
                    Tailwind grid class on a <td>, which does nothing, so the box was
                    stranded under the first column while Date and Time sat empty
                    beside it. A table with no rows also has no reason to show a
                    header, so both go together. */}
                {!hasRows ? (
                    <EmptyState
                        icon={<CalendarX />}
                        title='No check-ins yet'
                        description='Your visits appear here once the front desk checks you in.'
                    />
                ) : (
                    <div className='max-h-[300px] overflow-y-auto'>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className='w-10'>#</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead className='text-right'>Time</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {attendance.map((item: any, index: number) => (
                                    <TableRow key={index}>
                                        <TableCell className='text-muted-foreground tabular-nums'>
                                            {index + 1}
                                        </TableCell>
                                        <TableCell className='whitespace-nowrap'>
                                            {formatAppDate(item.date) ?? item.date}
                                        </TableCell>
                                        <TableCell className='text-right tabular-nums'>
                                            {item.time}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}

export default AttendanceSum
