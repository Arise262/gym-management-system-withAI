import type { Metadata } from "next";
// import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import Loader from "@/components/custom/Loader";
import { LoadingProvider } from "@/hooks/use-loading";
import GlobalLoader from "@/components/custom/Loader";
import { CookiesProvider } from "react-cookie";

// const geistSans = Geist({
//   variable: "--font-geist-sans",
//   subsets: ["latin"],
// });

// const geistMono = Geist_Mono({
//   variable: "--font-geist-mono",
//   subsets: ["latin"],
// });

export const metadata: Metadata = {
  title: "Synergy Fitness & Wellness Club",
  description: "Best gym in Akola",

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
      <head>
        <meta property="og:image" content="/synergy.png"/>
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="627" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/fav.png"/>
      </head>
      <body
        className={`antialiased`}
      >

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
        </ThemeProvider>
      </body>
    </html>
  );
}
