import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { IconLocation } from '@tabler/icons-react'
import { Calendar, CalendarCheck, Dumbbell, Mail, Phone } from 'lucide-react'
import Link from 'next/link'
import React from 'react'

type Props = {
    user: any
}

const UserDetails = ({
    user
}: Props) => {
  return (
    <Card>
        <CardHeader>
            <CardTitle className='text-muted-foreground'>Member Details</CardTitle>
            <CardAction>
                <Link href={'/member/workout'}>
                    <Button>
                        <Dumbbell className='mr-2'/>
                        View Exercises
                    </Button>
                </Link>
            </CardAction>
        </CardHeader>
        <CardContent>
            <div className='flex flex-col gap-2'>
                <div className='flex items-center gap-4 text-muted-foreground'><Phone className='mr-2' size={16}/> <span className='text-foreground'>{user?.phone}</span></div>
                <div className='flex items-center gap-4 text-muted-foreground'><Mail className='mr-2' size={16}/> <span className='text-foreground'>{user?.email}</span></div>
                <div className='flex items-center gap-4 text-muted-foreground'><IconLocation className='mr-2' size={16}/><span className='text-foreground'>{user?.address}</span> </div>
                <div className='flex items-center gap-4 text-muted-foreground'><Calendar className='mr-2' size={16}/> <span className='text-foreground'>{user?.DOB}</span></div>
                <div className='flex items-center gap-4 text-muted-foreground'><CalendarCheck className='mr-2' size={16}/> <span className='text-foreground'>{user?.DOJ}</span></div>
            </div>
        </CardContent>
    </Card>
  )
}

export default UserDetails