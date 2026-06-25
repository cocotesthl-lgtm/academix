import type { Metadata } from "next";
import "./globals.css";
import { TopProgressBar } from "@/components/system/TopProgressBar";
import { PendingNavOverlay } from "@/components/system/PendingNavOverlay";

export const metadata: Metadata = {
  title: "Curplat",
  description: "Plataforma SaaS para sitios y creators"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <TopProgressBar />
        <PendingNavOverlay />
        {children}
      </body>
    </html>
  );
}
