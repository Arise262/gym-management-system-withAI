"use client";

import * as React from "react";
import { toast } from "sonner";
import { IconDownload, IconX } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";

/**
 * Progressive-web-app plumbing, mounted once in the root layout.
 *
 *  1. Registers /sw.js in production and offers a one-tap reload when a new
 *     version has been installed behind the current page.
 *  2. Shows an "Install" card when the browser fires beforeinstallprompt
 *     (Chrome/Edge/Android), or a one-line Add-to-Home-Screen hint on iOS
 *     Safari, which has no prompt API. Either is dismissible for 14 days.
 *  3. Says so when the connection drops or returns.
 *
 * Nothing here runs in development: a service worker caching /_next/static
 * fights hot reload, and the install prompt needs a production manifest.
 */

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "pwa-install-dismissed-at";
const DISMISS_DAYS = 14;

function dismissedRecently(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    return at > 0 && Date.now() - at < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function rememberDismissal() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    /* private mode — fine, the card just comes back next visit */
  }
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIosSafari(): boolean {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (ua.includes("Mac") && "ontouchend" in document);
  const safari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  return ios && safari;
}

export function Pwa() {
  const [installEvent, setInstallEvent] = React.useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = React.useState(false);

  /* ── service worker ── */
  React.useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        // A worker waiting behind an active one means a new version shipped.
        const offer = (worker: ServiceWorker) =>
          toast("A new version is ready", {
            description: "Reload to get the latest CBG Fitness Center.",
            duration: Infinity,
            action: { label: "Reload", onClick: () => worker.postMessage({ type: "SKIP_WAITING" }) },
          });
        if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
        reg.addEventListener("updatefound", () => {
          const sw = reg.installing;
          if (!sw) return;
          sw.addEventListener("statechange", () => {
            if (sw.state === "installed" && navigator.serviceWorker.controller) offer(sw);
          });
        });
      })
      .catch((e) => console.warn("[pwa] service worker registration failed:", e));
  }, []);

  /* ── install prompt ── */
  React.useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (isStandalone() || dismissedRecently()) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", () => setInstallEvent(null));

    if (isIosSafari()) setShowIosHint(true);

    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  /* ── connectivity ── */
  React.useEffect(() => {
    const offline = () =>
      toast.warning("You are offline", {
        id: "net",
        description: "Pages you have not opened yet will not load until you reconnect.",
        duration: Infinity,
      });
    const online = () => toast.success("Back online", { id: "net", duration: 2500 });
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    if (!navigator.onLine) offline();
    return () => {
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
    };
  }, []);

  async function install() {
    if (!installEvent) return;
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    if (outcome === "dismissed") rememberDismissal();
    setInstallEvent(null);
  }

  function dismiss() {
    rememberDismissal();
    setInstallEvent(null);
    setShowIosHint(false);
  }

  if (!installEvent && !showIosHint) return null;

  return (
    <div
      role="dialog"
      aria-label="Install CBG Fitness Center"
      className="bg-card text-card-foreground fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-md items-center gap-3 rounded-xl border p-3 shadow-lg"
    >
      <img src="/icons/icon-192.png" alt="" width={40} height={40} className="size-10 shrink-0 rounded-lg" />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold">Install CBG Fitness Center</p>
        {installEvent ? (
          <p className="text-muted-foreground">Add it to your home screen for one-tap access to your plan and bookings.</p>
        ) : (
          <p className="text-muted-foreground">
            In Safari tap <span className="text-foreground font-medium">Share</span>, then{" "}
            <span className="text-foreground font-medium">Add to Home Screen</span>.
          </p>
        )}
      </div>
      {installEvent && (
        <Button size="sm" onClick={install}>
          <IconDownload className="mr-1 size-4" />
          Install
        </Button>
      )}
      <Button size="icon" variant="ghost" onClick={dismiss} aria-label="Not now">
        <IconX className="size-4" />
      </Button>
    </div>
  );
}
