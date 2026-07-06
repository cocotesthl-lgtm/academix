import type { Metadata } from "next";
import "./globals.css";
import { TopProgressBar } from "@/components/system/TopProgressBar";
import { PendingNavOverlay } from "@/components/system/PendingNavOverlay";

export const metadata: Metadata = {
  title: {
    default: "OfferNow — Sites 4 Everything",
    template: "%s · OfferNow"
  },
  description: "Creá tu propia plataforma web en Argentina y LatAm. Vendé publicaciones, eventos con tickets, suscripciones o mentorías. Todo en tu propio dominio, con tu marca, cobrando directo a tu MercadoPago.",
  icons: {
    icon: [
      { url: "/brand/offernow-icon.png", type: "image/png" }
    ],
    apple: [
      { url: "/brand/offernow-icon.png" }
    ]
  }
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
