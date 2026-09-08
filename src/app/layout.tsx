import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Shyft Studio — Internal Platform",
  description: "Sales, production, and visibility for Samyak's print business.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="antialiased">
      <body className="bg-surface text-ink-900 min-h-screen">{children}</body>
    </html>
  );
}
