import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fiverr Review Buyers",
  description: "Unauthenticated Fiverr review buyer intake dashboard"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
