import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { Suspense } from "react";
import BottomNav from "@/components/BottomNav";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Life Brain",
  description: "Your personal second brain for body & life know-how",
  // iOS home-screen app: full-screen, with a translucent status bar over our dark header.
  appleWebApp: { capable: true, title: "Life Brain", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafaf9" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0a09" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} antialiased`}>
      {/* min-h-lvh, not h-full/min-h-full: in the installed iPhone app, "100%" excludes the
          status bar, so on short pages iOS floated the fixed bottom nav upward. The large
          viewport height always covers the whole screen. */}
      <body className="min-h-lvh font-sans">
        {/* Safe areas: the installed iPhone app draws under the status bar and home indicator
            (viewportFit "cover" + translucent status bar), so pad by the device's insets.
            In a normal browser tab both insets are 0. */}
        <main className="mx-auto w-full max-w-md px-4 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-[calc(7rem+env(safe-area-inset-bottom))]">
          {children}
        </main>
        {/* usePathname can suspend on dynamic routes when cacheComponents is on. */}
        <Suspense>
          <BottomNav />
        </Suspense>
      </body>
    </html>
  );
}
