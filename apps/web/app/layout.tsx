import "../styles/globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Workspace CRM",
  description: "Configurable CRM workspace for lead intake and operations"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
