import type { Metadata, Viewport } from "next";
import { Geist_Mono, Noto_Sans_TC } from "next/font/google";
import { InstallBootstrap } from "@/components/pwa/install-bootstrap";
import { APP_BOOKMARK_NAME, APP_TAGLINE } from "@/lib/app-brand";
import "./globals.css";

const notoSansTc = Noto_Sans_TC({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: APP_BOOKMARK_NAME,
  description: APP_TAGLINE,
  applicationName: APP_BOOKMARK_NAME,
  appleWebApp: {
    capable: true,
    title: APP_BOOKMARK_NAME,
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0b0d11",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="zh-Hant"
      className={`dark ${notoSansTc.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[#0b0d11] text-foreground touch-manipulation">
        <InstallBootstrap />
        {children}
      </body>
    </html>
  );
}
