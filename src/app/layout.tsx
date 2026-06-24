import type { Metadata } from "next";
import "./globals.css";
import { TopProgressBar } from "@/components/system/TopProgressBar";

export const metadata: Metadata = {
  title: "Curplat",
  description: "Plataforma SaaS para sitios y creators"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <TopProgressBar />
        {children}
      </body>
    </html>
  );
}
