import "../styles/globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Studio OS",
  description: "Workspace CRM for architecture operations"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
