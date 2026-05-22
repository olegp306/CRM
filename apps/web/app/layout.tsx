import "../styles/globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reyzbikh architect CRM",
  description: "Architecture CRM for Reyzbikh architect operations"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
