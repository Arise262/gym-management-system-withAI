import Logo from '@/components/custom/Logo'
import { ModeToggle } from '@/components/custom/theme-toggle'
import { NotificationBell } from '@/components/notification-bell'
import React from 'react'

type Props = {
    user_name?: string
    /** Unread notification count, fetched by the page (server side). */
    unread?: number
}

const Header = ({
    user_name,
    unread = 0,
}: Props) => {
    return (
        <div className='space-y-2'>
            <div className='flex justify-between items-center'>
                <Logo />
                <div className='flex items-center gap-2'>
                    <NotificationBell href='/member/notifications' unread={unread} />
                    <ModeToggle/>
                </div>
            </div>
            <div className='flex justify-between items-center'>
                <p className='text-2xl text-gray-500'>Welcome back {" "}
                    <span className='text-foreground font-bold'>{user_name || 'Member'}</span>!
                </p>
            </div>

        </div>
    )
}

export default Header
