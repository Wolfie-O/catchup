import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CatchUp — Find Your Ballpark Crew",
  description: "Connect with baseball players near you. Play catch, find pickup games, take lessons, and more.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}