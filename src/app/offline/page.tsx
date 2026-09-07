import { IconWifiOff } from "@tabler/icons-react";
import Logo from "@/components/custom/Logo";

export const metadata = { title: "Offline" };

/**
 * Served by the service worker when a navigation fails with no network.
 * Deliberately static and dependency-free: it is precached at install time,
 * so it must render with nothing behind it — no session, no database.
 */
export default function OfflinePage() {
  return (
    <div className="flex min-h-svh w-full flex-col items-center justify-center gap-6 p-6 text-center">
      <Logo />
      <div className="bg-muted text-muted-foreground flex size-16 items-center justify-center rounded-full">
        <IconWifiOff className="size-8" />
      </div>
      <div className="max-w-sm space-y-2">
        <h1 className="text-xl font-semibold">You are offline</h1>
        <p className="text-muted-foreground text-sm">
          Synergy Fitness needs a connection to load your plan, bookings and payments — nothing personal is
          kept on this device. Reconnect and this page will refresh itself.
        </p>
      </div>
      <a href="/" className="text-sm underline underline-offset-4">
        Try again
      </a>
      {/* Auto-retry the moment the browser reports connectivity. */}
      <script
        dangerouslySetInnerHTML={{
          __html: `window.addEventListener('online',function(){location.replace('/')});`,
        }}
      />
    </div>
  );
}
