import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { PostHogProvider } from "@/components/PostHogProvider";
import { YandexMetrika } from "@/components/YandexMetrika";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://collab-lime-sigma.vercel.app"),
  title: {
    default: "Collab — совместная работа для команд",
    template: "%s · Collab",
  },
  description:
    "Бесплатный сервис для командной работы: канбан-доски, задачи, дедлайны и участники в одном месте. Видно кто над чем работает — и ничего не теряется.",
  openGraph: {
    title: "Collab — совместная работа для команд",
    description:
      "Бесплатный сервис для командной работы: канбан-доски, задачи, дедлайны и участники в одном месте. Видно кто над чем работает — и ничего не теряется.",
    type: "website",
    locale: "ru_RU",
    siteName: "Collab",
    url: "/",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ru"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <YandexMetrika />
        <PostHogProvider>{children}</PostHogProvider>
      </body>
    </html>
  );
}
