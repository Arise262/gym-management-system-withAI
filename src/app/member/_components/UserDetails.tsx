import MaskableDetails from './MaskableDetails'
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
 *
 * This stays a SERVER component and hands MaskableDetails plain strings.
 * `user` is a Prisma row whose phone is a BigInt, which cannot cross the
 * client boundary — passing the row straight through would throw at render.
 * Narrowing it here keeps that conversion in one place.
 */
const UserDetails = ({ user }: Props) => {
    return (
        <MaskableDetails
            phone={user?.phone ? String(user.phone) : undefined}
            email={user?.email ?? undefined}
            address={user?.address ?? undefined}
            dob={formatAppDate(user?.DOB)}
            memberSince={formatAppDate(user?.DOJ)}
        />
    )
}

export default UserDetails
