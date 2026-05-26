'use client';

import { useTransition, useState } from 'react';
import { grantEnrollmentAction } from '@/lib/enrollments/actions';

export function GrantEnrollmentForm({ courseId }: { courseId: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [email, setEmail] = useState('');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setMsg(null);
        start(async () => {
          const fd = new FormData();
          fd.set('course_id', courseId);
          fd.set('email', email);
          const res = await grantEnrollmentAction(fd);
          if (res.ok) {
            setMsg({ ok: true, text: `Acceso concedido a ${email}.` });
            setEmail('');
          } else {
            setMsg({ ok: false, text: res.error });
          }
        });
      }}
      className="space-y-2"
    >
      <div className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="alumno@email.com"
          className="flex-1 rounded-md bg-white/5 border border-white/15 px-3 py-2 focus:outline-none focus:border-white/40"
        />
        <button
          disabled={pending}
          className="rounded-md bg-white text-black px-4 py-2 text-sm font-medium hover:bg-white/90 disabled:opacity-50"
        >
          {pending ? 'Concediendo…' : 'Conceder acceso'}
        </button>
      </div>
      {msg && (
        <div
          className={`text-xs rounded px-3 py-1.5 ${
            msg.ok
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-200'
              : 'bg-red-500/10 border border-red-500/30 text-red-200'
          }`}
        >
          {msg.text}
        </div>
      )}
    </form>
  );
}
