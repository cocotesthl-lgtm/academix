import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Curplat",
  description: "Plataforma SaaS para academias y creators"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
