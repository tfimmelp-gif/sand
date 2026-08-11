import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Link Platform",
  description: "Production multi-tenant link management platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
