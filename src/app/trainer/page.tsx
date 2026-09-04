import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import LogoutButton from "@/components/custom/LogoutButton"
import { requireRole } from "@/lib/session"

// Placeholder landing so TRAINER sessions have somewhere to go. The real
// trainer dashboard, schedule and assigned-members views land in Phase 6.
export default async function Page() {
  const user = await requireRole("TRAINER")

  return (
    <div className="p-4 grid grid-cols-1 gap-4 max-w-xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Trainer area</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-muted-foreground text-sm">
            Signed in as <span className="text-foreground">{user.email}</span>.
          </p>
          <p className="text-muted-foreground text-sm">
            Your schedule, assigned members and chat arrive in a later phase.
          </p>
          <Separator />
          <LogoutButton className="text-red-500 w-fit" />
        </CardContent>
      </Card>
    </div>
  )
}
