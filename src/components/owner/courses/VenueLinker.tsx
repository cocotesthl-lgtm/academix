'use client';

import { useTransition } from 'react';
import { toggleCourseVenueAction } from '@/lib/venues/actions';

export type VenueOpt = { id: string; name: string; address: string | null; active: boolean };

export function VenueLinker({ courseId, allVenues, linkedIds }: {
  courseId: string;
  allVenues: VenueOpt[];
  linkedIds: string[];
}) {
  const [pending, start] = useTransition();
  const linkedSet = new Set(linkedIds);

  function toggle(venueId: string) {
    start(async () => {
      const fd = new FormData();
      fd.set('course_id', courseId);
      fd.set('venue_id', venueId);
      await toggleCourseVenueAction(fd);
    });
  }

  if (allVenues.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-white/15 p-4 text-sm text-white/55">
        Todavía no cargaste sedes. <a href="/owner/venues" className="text-fuchsia-300 underline">Cargar sedes →</a>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {allVenues.map((v) => {
        const isLinked = linkedSet.has(v.id);
        return (
          <button
            key={v.id}
            type="button"
            disabled={pending || !v.active}
            onClick={() => toggle(v.id)}
            className={`w-full text-left rounded-lg border p-3 transition ${
              isLinked
                ? 'border-emerald-400/60 bg-emerald-400/10'
                : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.06]'
            } ${!v.active && 'opacity-40'}`}
          >
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <div className="text-sm font-semibold flex items-center gap-2">
                  📍 {v.name}
                  {!v.active && <span className="text-[10px] uppercase bg-rose-500/20 text-rose-200 px-1.5 rounded">inactiva</span>}
                </div>
                {v.address && <div className="text-xs text-white/55 truncate">{v.address}</div>}
              </div>
              <span className={`text-xs font-semibold ${isLinked ? 'text-emerald-300' : 'text-white/40'}`}>
                {isLinked ? '✓ ofrecido aquí' : 'no ofrecido'}
              </span>
            </div>
          </button>
        );
      })}
      <a href="/owner/venues" className="text-xs text-fuchsia-300 hover:underline inline-block mt-1">
        + Gestionar sedes
      </a>
    </div>
  );
}
