'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Calendar, CalendarCheck, Eye, EyeOff, Mail, MapPin, Phone } from 'lucide-react'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DetailList, DetailRow } from '@/components/detail-list'
import { Button } from '@/components/ui/button'

const STORAGE_KEY = 'member-details-revealed'

/**
 * Fixed width on purpose. A mask that tracked the real length would leak it —
 * an eleven-star phone number and a four-star one say different things.
 */
const MASK = '********'

function storedPreference(): boolean {
    try {
        return localStorage.getItem(STORAGE_KEY) === 'true'
    } catch {
        return false
    }
}

function rememberPreference(revealed: boolean) {
    try {
        localStorage.setItem(STORAGE_KEY, String(revealed))
    } catch {
        /* private mode — the card simply starts masked again next visit */
    }
}

type Props = {
    phone?: string
    email?: string
    address?: string
    dob?: string
    memberSince?: string
}

/**
 * The member's own record, masked behind an eye toggle.
 *
 * A gym floor is a shoulder-surfing environment: the member opens this on a
 * phone with people beside them, and the card holds their mobile number, email,
 * home address and date of birth. So the default is HIDDEN and revealing is the
 * deliberate act, not the other way round — a card that showed everything until
 * you hid it would have already exposed the data by the time you reached for
 * the button.
 *
 * The choice is remembered per device, so a member who prefers it open is not
 * clicking every visit.
 */
const MaskableDetails = ({ phone, email, address, dob, memberSince }: Props) => {
    // Masked on the server and on first paint, then the stored preference is
    // applied. Seeding useState from localStorage instead would either mismatch
    // hydration or flash the real values before an effect could hide them.
    const [revealed, setRevealed] = useState(false)

    useEffect(() => {
        if (storedPreference()) setRevealed(true)
    }, [])

    const toggle = () => {
        const next = !revealed
        setRevealed(next)
        rememberPreference(next)
    }

    /**
     * Masks real values only. Asterisks over an address nobody has entered
     * would imply there is one, and the row's own "No address on file" is
     * both truthful and not private.
     */
    const show = (value?: string): ReactNode => {
        if (revealed || !value) return value
        return (
            <>
                <span aria-hidden='true'>{MASK}</span>
                {/* Otherwise a screen reader announces eight asterisks. */}
                <span className='sr-only'>Hidden</span>
            </>
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className='text-base'>Your details</CardTitle>
                <CardAction>
                    <Button
                        type='button'
                        variant='ghost'
                        size='icon'
                        onClick={toggle}
                        aria-pressed={revealed}
                        aria-label={revealed ? 'Hide your details' : 'Show your details'}
                        title={revealed ? 'Hide your details' : 'Show your details'}
                        className='text-muted-foreground hover:text-foreground'
                    >
                        {revealed ? (
                            <EyeOff className='size-4' />
                        ) : (
                            <Eye className='size-4' />
                        )}
                    </Button>
                </CardAction>
            </CardHeader>
            <CardContent>
                <DetailList>
                    <DetailRow label='Phone' icon={<Phone />} value={show(phone)} />
                    <DetailRow label='Email' icon={<Mail />} value={show(email)} />
                    <DetailRow
                        label='Address'
                        icon={<MapPin />}
                        value={show(address)}
                        fallback='No address on file'
                    />
                    <DetailRow
                        label='Date of birth'
                        icon={<Calendar />}
                        value={show(dob)}
                    />
                    {/* Not masked: when someone joined the gym is not personal
                        data, and hiding it would buy no privacy. */}
                    <DetailRow
                        label='Member since'
                        icon={<CalendarCheck />}
                        value={memberSince}
                    />
                </DetailList>
            </CardContent>
        </Card>
    )
}

export default MaskableDetails
