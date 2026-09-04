"use client";

import { IconLogout } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Logout } from "@/action/auth.action";

export default function LogoutButton({
  className,
}: {
  className?: string;
}) {
  return (
    <form action={Logout}>
      <Button type="submit" variant="ghost" className={className}>
        <IconLogout className="mr-2" />
        Log out
      </Button>
    </form>
  );
}
