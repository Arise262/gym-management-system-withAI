import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { LoadingProvider } from "@/hooks/use-loading";
import GlobalLoader from "@/components/custom/Loader";
import { Pwa } from "@/components/pwa";

const APP_NAME = "CBG Fitness Center";

// Barlow is the athletic/sports pairing: the condensed cut carries headings and
// stat numbers, the regular cut carries body copy. Loading them through
// next/font means they are self-hosted and preloaded — no layout shift, and no
// request to fonts.gstatic.com at runtime.
const barlow = Barlow({
  // Barlow has no U+20B1 ₱ glyph in ANY Google subset (measured: it matches the
  // fallback width exactly while 0/P/$ do not), so latin-ext buys nothing here.
  // globals.css declares an explicit fallback face for that one codepoint.
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-barlow",
  display: "swap",
});

const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-barlow-condensed",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · CBG Fitness Center` },
  description: "Your workout plan, trainer bookings, payments and progress — CBG Fitness Center, Makati City.",
  applicationName: "CBG Fitness Center",
  manifest: "/manifest.json",
  // iOS has no manifest support for these; it reads the meta tags instead.
  appleWebApp: {
    capable: true,
    title: "CBG",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
  // Next 15 emits the standard `mobile-web-app-capable` for appleWebApp.capable;
  // older iOS still looks for the Apple-prefixed name, so ship both.
  other: { "apple-mobile-web-app-capable": "yes" },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: APP_NAME,
    description: "Best gym in Makati City",
    images: [{ url: "/logo.png", width: 1108, height: 1073 }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Lets the app paint under the iPhone notch/home bar when installed.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // suppressHydrationWarning on <html> is required by next-themes, not a
  // workaround for a bug of ours. Its script runs before React hydrates and
  // writes class and style="color-scheme" onto <html> so the page never
  // flashes the wrong theme — which by definition makes the client markup
  // differ from the server's. The suppression is one level deep, so a genuine
  // mismatch anywhere inside <html> is still reported.
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${barlow.variable} ${barlowCondensed.variable} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <LoadingProvider>
            <GlobalLoader />
            {children}
          </LoadingProvider>
          <Toaster />
          <Pwa />
        </ThemeProvider>
      </body>
    </html>
  );
}
