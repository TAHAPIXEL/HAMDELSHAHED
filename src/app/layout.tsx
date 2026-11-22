import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { themeBootScript } from "@/lib/theme";

export const metadata: Metadata = {
  title: "هَمدِل | دبیرستان شاهد شهیدان فهیمی",
  description:
    "سامانه گفت‌وگو، آزمون آنلاین، تکالیف، حضور و غیاب و اطلاعیه‌های دبیرستان شاهد شهیدان فهیمی",
  // لوگو از public/ سرو می‌شود (مسیرهای app/icon.* روی Vercel خطای 500 می‌دادند)
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-192.png", type: "image/png", sizes: "192x192" },
    ],
    apple: { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
  },
};

export const viewport: Viewport = {
  themeColor: "#161616",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <head>
        {/* پوسته‌ی ذخیره‌شده‌ی کاربر قبل از رسم صفحه اعمال می‌شود (بدون چشمک رنگ) */}
        <script dangerouslySetInnerHTML={{ __html: themeBootScript() }} />
        <link
          rel="preload"
          href="/fonts/abar/AbarMid-Regular.woff"
          as="font"
          type="font/woff"
          crossOrigin="anonymous"
        />
      </head>
      <body className="bg-app text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
