'use client';

import { useState, useEffect } from 'react';

/**
 * Popup del hero que rota entre ventas ficticias de distintas verticales,
 * demostrando la variedad de productos que soporta OfferNow. Cambia cada
 * 3.5s con fade sutil. La demora inicial es aleatoria (0-2s) para que si
 * hay varios popups en pantalla no se sincronicen.
 */

type Sale = {
  timeAgo: string;
  product: string;
  price: string;
};

const SALES: Sale[] = [
  { timeAgo: 'hace 4 minutos', product: 'Curso de inglés A1', price: '$9.900' },
  { timeAgo: 'hace 2 minutos', product: 'Remera edición limitada · M', price: '$18.500' },
  { timeAgo: 'hace 6 minutos', product: 'Entrada · Festival electrónico', price: '$25.000' },
  { timeAgo: 'hace 1 minuto',  product: 'Gift card · Spa Rieck', price: '$15.000' },
  { timeAgo: 'hace 3 minutos', product: 'Mentoría 1-a-1 · 60min', price: '$28.000' },
  { timeAgo: 'hace 8 minutos', product: 'Reserva mesa · Sábado 21hs', price: '$4.500' },
  { timeAgo: 'hace 5 minutos', product: 'Pack VIP · Mensual', price: '$6.900' },
  { timeAgo: 'hace 12 minutos', product: 'Libro firmado · Ensayo', price: '$12.400' },
  { timeAgo: 'hace 7 minutos', product: 'Turno corte + barba', price: '$8.500' },
  { timeAgo: 'hace 9 minutos', product: 'Kit indumentaria yoga', price: '$34.900' }
];

export function LastSalePopup() {
  const [index, setIndex] = useState(0);
  const [fadeIn, setFadeIn] = useState(true);

  useEffect(() => {
    // Delay aleatorio inicial para no sincronizar múltiples popups
    const initialDelay = Math.floor(Math.random() * 2000);
    const t0 = setTimeout(() => {
      const interval = setInterval(() => {
        // Fade out → cambiar item → fade in
        setFadeIn(false);
        setTimeout(() => {
          setIndex((i) => (i + 1) % SALES.length);
          setFadeIn(true);
        }, 250);
      }, 3500);
      return () => clearInterval(interval);
    }, initialDelay);
    return () => clearTimeout(t0);
  }, []);

  const s = SALES[index];

  return (
    <div className="hidden md:block absolute top-4 right-4 lg:-right-4 lg:top-0 w-72 rounded-xl bg-white shadow-xl p-4 z-10 border border-neutral-100">
      <div className="flex items-center gap-2 text-xs text-neutral-500 uppercase tracking-wider mb-2">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
        Última venta
      </div>
      <div
        className={`transition-opacity duration-300 ease-out ${fadeIn ? 'opacity-100' : 'opacity-0'}`}
      >
        <div className="font-bold text-lg text-neutral-900">{s.timeAgo}</div>
        <div className="text-xs text-neutral-500 mt-0.5 truncate">
          {s.product} · <span className="font-semibold text-neutral-900">{s.price}</span>
        </div>
      </div>
    </div>
  );
}
