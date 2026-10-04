import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Mono, Instrument_Sans } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";

const instrumentSans = Instrument_Sans({
  variable: "--font-ui",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  axes: ["opsz"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-data",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "蛋白质分类图谱 · Proteome Atlas",
  description:
    "基于 UniProtKB Swiss-Prot 全量 reviewed 数据的蛋白分类图谱：10 种模式生物 87,728 条蛋白，按官方超家族层级组织，支持家族树浏览、进化视角与跨物种比较。",
  keywords: ["蛋白分类", "UniProt", "超家族", "模式生物", "进化", "直系同源", "蛋白家族", "可视化"],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body
        className={`${instrumentSans.variable} ${fraunces.variable} ${plexMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
