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
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">
        <main className="mx-auto w-full max-w-md px-4 pt-6 pb-28">{children}</main>
        {/* usePathname can suspend on dynamic routes when cacheComponents is on. */}
        <Suspense>
          <BottomNav />
        </Suspense>
      </body>
    </html>
  );
}
