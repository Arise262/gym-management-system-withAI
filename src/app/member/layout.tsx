import { requireRole } from "@/lib/session"

export default async function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  // Replaces the old client-side localStorage check, which any visitor could
  // satisfy by setting a key in devtools.
  await requireRole("MEMBER")

  return <div>{children}</div>
}
