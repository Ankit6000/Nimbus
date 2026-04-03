import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, Space_Grotesk } from "next/font/google";
import { NavigationProgress } from "@/components/navigation-progress";
import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

const headingFont = Space_Grotesk({
  variable: "--font-heading",
  subsets: ["latin"],
});

const bodyFont = IBM_Plex_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export const metadata: Metadata = {
  title: "O__O",
  description: "Private vault portal with admin-managed access, uploads, and hidden storage channels.",
  metadataBase: new URL(appUrl),
  applicationName: "O__O",
  manifest: "/manifest.webmanifest",
  alternates: {
    canonical: "/",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "O__O",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [{ url: "/o__o-icon.svg", type: "image/svg+xml" }],
    shortcut: [{ url: "/o__o-icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/o__o-icon.svg" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#f7f0e4",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${headingFont.variable} ${bodyFont.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <PwaRegister />
        <NavigationProgress />
        {children}
      </body>
    </html>
  );
}
