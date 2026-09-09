import { CreditCard } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/empty-state'
import { formatAppDate } from '@/lib/format'

type Props = {
  activeSales: any[]
  expiredSales: any[]
}

function MembershipRow({ sale, expired }: { sale: any; expired?: boolean }) {
  return (
    <li className='flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5'>
      <span className='font-medium'>{sale.service?.name}</span>
      <span className='text-muted-foreground text-sm whitespace-nowrap tabular-nums'>
        {formatAppDate(sale.startDate) ?? sale.startDate}
        {' – '}
        {formatAppDate(sale.endDate) ?? sale.endDate}
      </span>
      {expired ? null : (
        <Badge variant='secondary' className='ml-auto sm:ml-0'>
          Active
        </Badge>
      )}
    </li>
  )
}

const Sales = ({ activeSales, expiredSales }: Props) => {
  const hasActive = activeSales?.length > 0
  const hasExpired = expiredSales?.length > 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-base'>Membership</CardTitle>
      </CardHeader>
      <CardContent className='space-y-6'>
        <section>
          <h3 className='text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase'>
            Current
          </h3>
          {hasActive ? (
            <ul className='divide-border divide-y'>
              {activeSales.map((sale: any) => (
                <MembershipRow key={sale.id} sale={sale} />
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={<CreditCard />}
              title='No active membership'
              description='Talk to the front desk to start or renew a plan.'
            />
          )}
        </section>

        {/* Expired plans are history, not a headline — only render the section
            when there is something in it, instead of an empty box for a member
            who has never had one. */}
        {hasExpired ? (
          <section>
            <h3 className='text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase'>
              Past
            </h3>
            <ul className='divide-border divide-y opacity-70'>
              {expiredSales.map((sale: any) => (
                <MembershipRow key={sale.id} sale={sale} expired />
              ))}
            </ul>
          </section>
        ) : null}
      </CardContent>
    </Card>
  )
}

export default Sales
