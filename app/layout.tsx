import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SlmReturnObserver } from "@/components/SlmReturnObserver";
import { DisguiseProvider } from "@/components/DisguiseMode";
import { Analytics } from '@vercel/analytics/next';

export const metadata: Metadata = {
  title: "Locket",
  description: "Read the drama. Post the update. Stay anonymous."
};

export const viewport: Viewport = {
  themeColor: "#353e4a",
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="pb-24">
  <DisguiseProvider>
  <SlmReturnObserver />
  {children}
  <footer className="text-center py-6 text-sm text-gray-400">
    <a href="/privacy" className="underline hover:text-gray-600">Privacy Policy</a>
  </footer>
  </DisguiseProvider>
  <Analytics />
</body>
    </html>
  );
}
