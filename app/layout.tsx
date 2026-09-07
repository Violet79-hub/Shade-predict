import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Shade 2050 | Melbourne Canopy Scenario Planner",
  description: "Explore how tree planting scenarios could grow Melbourne's canopy and reduce urban heat by 2035 and 2050.",
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
    <html lang="en-AU">
      <body className="antialiased">{children}</body>
    </html>
  );
}
