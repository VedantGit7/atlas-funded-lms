import type { Metadata } from "next";

import "./globals.css";
import { PostHogProvider } from "../observability/PostHogProvider";

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
      <body>
        <PostHogProvider>{children}</PostHogProvider>
      </body>
    </html>
  );
}
