import type { Metadata } from "next";
import "./globals.css";
import "./redesign.css";
import "./month.css";
import "./motion.css";
import "./onboarding.css";
import "./navigation.css";
import "./friendly.css";
import "./spending.css";
import "./conversations.css";
export const metadata: Metadata = {
  title: "First Month — Shared bills. A plan for both of you.",
  description:
    "Compare how to split your shared bills, see what each of you has left, and agree on a monthly plan together. Free to use. No bank connection.",
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
