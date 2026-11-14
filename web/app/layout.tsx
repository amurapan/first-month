import type { Metadata } from "next";
import "./globals.css";
import "./redesign.css";
import "./month.css";
export const metadata: Metadata = {
  title: "First Month — Make room for both of you",
  description:
    "Share a home, make money decisions together. Compare monthly contributions, plan purchases, track savings, and keep a small weekly check-in.",
  referrer: "no-referrer",
  icons: { icon: "/favicon.svg" },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
