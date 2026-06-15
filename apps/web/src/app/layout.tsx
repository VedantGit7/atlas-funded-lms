import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Atlas LMS",
  description: "Atlas LMS application shell",
};

type RootLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
