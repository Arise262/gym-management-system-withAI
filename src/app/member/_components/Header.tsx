import React from 'react'
import Logo from '@/components/custom/Logo'
import { ModeToggle } from '@/components/custom/theme-toggle'
import { NotificationBell } from '@/components/notification-bell'

type Props = {
    user_name?: string
    /** Unread notification count, fetched by the page (server side). */
    unread?: number
}

const Header = ({ user_name, unread = 0 }: Props) => {
    return (
        <header className='space-y-4'>
            <div className='flex items-center justify-between'>
                <Logo />
                <div className='flex items-center gap-1'>
                    <NotificationBell href='/member/notifications' unread={unread} />
                    <ModeToggle />
                </div>
            </div>
            {/* The member's name is the loudest thing on the page — it is the one
                bit of the screen that is unmistakably theirs. Condensed display
                cut, tight leading, greeting subordinate to the name. */}
            <div>
                <p className='text-muted-foreground text-sm'>Welcome back</p>
                <h1 className='font-display text-3xl leading-none font-semibold'>
                    {user_name || 'Member'}
                </h1>
            </div>
        </header>
    )
}

export default Header
