import Logo from '@/components/custom/Logo'
import { ModeToggle } from '@/components/custom/theme-toggle'
import { Button } from '@/components/ui/button'
import React from 'react'

type Props = {
    user_name?: string
}

const Header = ({
    user_name
}: Props) => {
    return (
        <div className='space-y-2'>
            <div className='flex justify-between items-center'>
                <Logo />
                <ModeToggle/>
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