import type { Metadata, Viewport } from "next";
import { Geist_Mono, Noto_Sans_TC } from "next/font/google";
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
  title: "智路臺灣 Smart Road Taiwan",
  description: "台灣智慧駕駛地圖與即時道路情報 Prototype · 臺南示範",
  applicationName: "Smart Road Taiwan",
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
      <body className="h-full overflow-hidden overscroll-none bg-[#0b0d11] text-foreground touch-manipulation">
        {children}
      </body>
    </html>
  );
}
