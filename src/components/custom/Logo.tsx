import Image from 'next/image'
import React from 'react'

type Props = {}

const Logo = (props: Props) => {
    return (
        <div>
            <Image src="/logo.png" width={40} height={40} alt="CBG Fitness Center" className='dark:hidden' />
            <Image src="/logo-light.png" width={40} height={40} alt="CBG Fitness Center" className='hidden dark:block' />
        </div>
    )
}

export default Logo