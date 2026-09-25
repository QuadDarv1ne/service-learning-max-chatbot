import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "next-themes";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "cyrillic"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "Чат-бот MAX — Обучение служением. Первые (v2.1)",
  description:
    "Админ-панель чат-бота для информационной поддержки участников просветительской программы «Обучение служением. Первые». База знаний FAQ, статистика, логи обращений, аналитика и аудит.",
  keywords: [
    "MAX",
    "чат-бот",
    "Обучение служением",
    "Первые",
    "Добро.рф",
    "FAQ",
    "база знаний",
    "аналитика",
    "v2.1",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          {children}
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
