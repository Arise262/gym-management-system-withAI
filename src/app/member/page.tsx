import Link from 'next/link'
import { IconKey } from '@tabler/icons-react'
import { getAllDetailsOfMember } from '@/action/user.action'
import UserDetails from './_components/UserDetails'
import Header from './_components/Header'
import AttendanceSum from './_components/AttendanceSum'
import Sales from './_components/Sales'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import LogoutButton from '@/components/custom/LogoutButton'

// Server component: the member is resolved from the session inside the action,
// so there is no client fetch and no id in the browser to tamper with.
export default async function Page() {
  const data = await getAllDetailsOfMember()

  return (
    <div className='p-4 grid grid-cols-1 gap-4 max-w-xl mx-auto'>
      <Header user_name={data.user?.name} />
      <UserDetails user={data.user} />
      <AttendanceSum attendance={data.allAttendanceOfMember} />
      <Sales activeSales={data.activeSales} expiredSales={data.inActiveSales} />
      <Separator />
      <Link href={'/member/change-password'}>
        <Button variant={'ghost'} className='w-fit'>
          <IconKey className='mr-2' />
          Change password
        </Button>
      </Link>
      <LogoutButton className='text-red-500 w-fit' />
    </div>
  )
}
