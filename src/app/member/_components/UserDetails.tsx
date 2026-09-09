import { Calendar, CalendarCheck, Mail, MapPin, Phone } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DetailList, DetailRow } from '@/components/detail-list'
import { formatAppDate } from '@/lib/format'

type Props = {
    user: any
}

/**
 * Member details.
 *
 * The navigation that used to be crammed into this card's <CardAction> slot
 * now lives in QuickActions, so this card does one job: show the member's own
 * record, every value under a label, dates rendered as words instead of raw
 * `dd-MM-yyyy`.
 */
const UserDetails = ({ user }: Props) => {
    return (
        <Card>
            <CardHeader>
                <CardTitle className='text-base'>Your details</CardTitle>
            </CardHeader>
            <CardContent>
                <DetailList>
                    <DetailRow
                        label='Phone'
                        icon={<Phone />}
                        value={user?.phone ? String(user.phone) : undefined}
                    />
                    <DetailRow label='Email' icon={<Mail />} value={user?.email} />
                    <DetailRow
                        label='Address'
                        icon={<MapPin />}
                        value={user?.address}
                        fallback='No address on file'
                    />
                    <DetailRow
                        label='Date of birth'
                        icon={<Calendar />}
                        value={formatAppDate(user?.DOB)}
                    />
                    <DetailRow
                        label='Member since'
                        icon={<CalendarCheck />}
                        value={formatAppDate(user?.DOJ)}
                    />
                </DetailList>
            </CardContent>
        </Card>
    )
}

export default UserDetails
