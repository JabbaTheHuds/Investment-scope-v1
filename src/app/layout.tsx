import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { AppShell } from "@/components/shell/AppShell";
import { PreferencesProvider, themeInitScript } from "@/components/shell/PreferencesProvider";
import { ServiceWorkerRegistrar } from "@/components/shell/ServiceWorkerRegistrar";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono-face", display: "swap" });

export const metadata: Metadata = {
  title: { default: "CryptoScope AI", template: "%s · CryptoScope AI" },
  description: "Cryptocurrency market intelligence: real market data, transparent analytics and clearly-labelled freshness.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg" },
  appleWebApp: { capable: true, title: "CryptoScope", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#0a0b0d",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" className={`${inter.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="font-sans antialiased">
        <PreferencesProvider>
          <AppShell>{children}</AppShell>
        </PreferencesProvider>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
