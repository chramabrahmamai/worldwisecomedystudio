import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WorldWise Comedy Studio",
  description: "Turn verified world stories into review-ready humorous video packages.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
