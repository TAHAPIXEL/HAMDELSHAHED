import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "هَمدِل | دبیرستان شاهد شهیدان فهیمی",
  description:
    "سامانه گفت‌وگو، آزمون آنلاین، تکالیف، حضور و غیاب و اطلاعیه‌های دبیرستان شاهد شهیدان فهیمی",
};

export const viewport: Viewport = {
  themeColor: "#4f46e5",
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body className="antialiased">{children}</body>
    </html>
  );
}
