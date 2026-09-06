"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { IconCreditCard } from "@tabler/icons-react";
import { StartCheckout } from "@/action/payment.action";
import { Button } from "@/components/ui/button";

/**
 * Sends the member to PayMongo's hosted checkout.
 *
 * A full navigation rather than router.push: the destination is PayMongo's
 * domain, not a route in this app.
 */
export function PayButton({ saleId, amountLabel }: { saleId: string; amountLabel: string }) {
  const [pending, start] = useTransition();

  return (
    <Button
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await StartCheckout(saleId);
          if (res.success) {
            window.location.href = res.checkoutUrl;
          } else {
            toast.error(res.error);
          }
        })
      }
    >
      <IconCreditCard className="mr-2 size-4" />
      {pending ? "Opening checkout…" : `Pay ${amountLabel}`}
    </Button>
  );
}
