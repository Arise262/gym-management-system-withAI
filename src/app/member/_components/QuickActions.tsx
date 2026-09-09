import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  CalendarPlus,
  CreditCard,
  Dumbbell,
  MessageCircle,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The member's seven destinations.
 *
 * These used to live inside the Member Details card's <CardAction> slot — a
 * shadcn grid cell sized for one small button. Seven buttons in a single
 * flex row overflowed the card and ran off the right edge of the page, and on
 * a phone (which is where a PWA member actually is) it was unusable. A grid
 * of tiles wraps instead of overflowing, gives each target a comfortable
 * touch area, and promotes the primary action rather than showing seven
 * equal-weight pills.
 */
type Action = {
  href: string;
  label: string;
  icon: LucideIcon;
  hint: string;
  /** Exactly one action carries the brand fill, so the eye has somewhere to land. */
  primary?: boolean;
};

const ACTIONS: Action[] = [
  { href: "/member/workout-plan", label: "My plan", icon: Sparkles, hint: "Today's workout", primary: true },
  { href: "/member/progress", label: "Progress", icon: TrendingUp, hint: "Streak & volume" },
  { href: "/member/chat", label: "Assistant", icon: Sparkles, hint: "Ask about your plan" },
  { href: "/member/trainers", label: "Book a trainer", icon: CalendarPlus, hint: "Find a slot" },
  { href: "/member/workout", label: "Exercises", icon: Dumbbell, hint: "Browse the library" },
  { href: "/member/messages", label: "Messages", icon: MessageCircle, hint: "Your trainer" },
  { href: "/member/payments", label: "Payments", icon: CreditCard, hint: "Balance & receipts" },
];

export default function QuickActions() {
  return (
    <nav aria-label="Member sections">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {ACTIONS.map(({ href, label, icon: Icon, hint, primary }) => (
          <li key={href}>
            <Link
              href={href}
              className={cn(
                "group flex h-full min-h-[5.5rem] flex-col justify-between rounded-xl border p-3 transition-colors",
                "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
                primary
                  ? "bg-brand text-brand-foreground border-transparent hover:brightness-110"
                  : "bg-card hover:border-brand/40 hover:bg-accent"
              )}
            >
              <Icon
                aria-hidden="true"
                className={cn("size-5", primary ? "" : "text-brand")}
              />
              <span>
                <span className="font-display block text-base leading-tight font-semibold">
                  {label}
                </span>
                <span
                  className={cn(
                    "block text-xs",
                    primary ? "text-brand-foreground/80" : "text-muted-foreground"
                  )}
                >
                  {hint}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
