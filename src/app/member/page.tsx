import Link from 'next/link'
import { IconKey } from '@tabler/icons-react'
import { getAllDetailsOfMember } from '@/action/user.action'
import UserDetails from './_components/UserDetails'
import Header from './_components/Header'
import AttendanceSum from './_components/AttendanceSum'
import Sales from './_components/Sales'
import QuickActions from './_components/QuickActions'
import { Button } from '@/components/ui/button'
import LogoutButton from '@/components/custom/LogoutButton'
import { GetUnreadCount } from '@/action/notification.action'

// Server component: the member is resolved from the session inside the action,
// so there is no client fetch and no id in the browser to tamper with.
export default async function Page() {
  const data = await getAllDetailsOfMember()
  const unread = await GetUnreadCount()

  return (
    // max-w-2xl rather than max-w-xl: the action grid needs the room, and the
    // page reads as a column on a phone either way.
    <div className='bg-surface min-h-svh'>
      <div className='mx-auto flex max-w-2xl flex-col gap-6 p-4 pb-12'>
        <Header user_name={data.user?.name} unread={unread} />

        {/* Actions come first. What a member opens this app to do is start a
            workout or check their plan — not read their own phone number. */}
        <QuickActions />

        <Sales activeSales={data.activeSales} expiredSales={data.inActiveSales} />
        <AttendanceSum attendance={data.allAttendanceOfMember} />
        <UserDetails user={data.user} />

        {/* Account actions are deliberately quiet and last. */}
        <div className='flex flex-wrap items-center gap-2 pt-2'>
          <Button asChild variant='outline' size='sm'>
            <Link href='/member/change-password'>
              <IconKey className='size-4' />
              Change password
            </Link>
          </Button>
          <LogoutButton className='text-muted-foreground hover:text-destructive w-fit' />
        </div>
      </div>
    </div>
  )
}
