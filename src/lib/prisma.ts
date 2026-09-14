import { PrismaClient } from '@prisma/client'

const globalForPrisma = global as unknown as {
    prisma: PrismaClient
}

/**
 * How many connections this process may hold open to the pooler.
 *
 * DATABASE_URL was set up with connection_limit=1, which makes every
 * Promise.all in the app silently sequential: queries queue on the one
 * connection, so a dashboard of fourteen independent queries still costs
 * fourteen round trips. Five lets them overlap. It is set here rather than in
 * the env so the decision is reviewable in git and the deployed secret never
 * needs editing.
 *
 * Budget: Supabase's transaction-mode pooler (port 6543) accepts 200 client
 * connections on the free tier; Vercel runs a handful of instances of this
 * app, so five each stays far inside it. The direct URL for migrations is
 * untouched.
 */
const POOL_SIZE = 5

function withPoolSize(url: string | undefined): string | undefined {
    if (!url) return url
    try {
        const u = new URL(url)
        u.searchParams.set('connection_limit', String(POOL_SIZE))
        return u.toString()
    } catch {
        return url
    }
}

const prisma =
    globalForPrisma.prisma ||
    new PrismaClient({ datasources: { db: { url: withPoolSize(process.env.DATABASE_URL) } } })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma
