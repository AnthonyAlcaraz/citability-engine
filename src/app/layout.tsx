import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Citability Engine — AEO + GEO",
  description: "Self-improving AEO/GEO platform for AI citation tracking, scoring & optimization",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
