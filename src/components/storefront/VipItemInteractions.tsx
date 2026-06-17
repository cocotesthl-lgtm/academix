'use client';

import { useState, useTransition } from 'react';
import { toggleVipLikeAction, addVipCommentAction, deleteVipCommentAction } from '@/lib/vip/interactions';

export type VipComment = {
  id: string;
  user_id: string;
  comment: string;
  created_at: string;
  author_name?: string | null;
  author_email?: string | null;
};

/**
 * Bloque de likes + comentarios para un media_item de pack VIP.
 * Se renderiza debajo de cada item en la galería desbloqueada.
 */
export function VipItemInteractions({
  courseId,
  slug,
  itemId,
  initialLikeCount,
  initialLiked,
  comments,
  currentUserId,
  ownerUserIds
}: {
  courseId: string;
  slug: string;
  itemId: string;
  initialLikeCount: number;
  initialLiked: boolean;
  comments: VipComment[];
  currentUserId: string | null;
  ownerUserIds: string[];
}) {
  const [liked, setLiked] = useState(initialLiked);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [pending, start] = useTransition();
  const [localComments, setLocalComments] = useState(comments);

  function toggleLike() {
    if (!currentUserId) return;
    start(async () => {
      const fd = new FormData();
      fd.set('course_id', courseId); fd.set('item_id', itemId); fd.set('slug', slug);
      const wasLiked = liked;
      setLiked(!wasLiked);
      setLikeCount((c) => wasLiked ? Math.max(0, c - 1) : c + 1);
      await toggleVipLikeAction(fd);
    });
  }

  function postComment() {
    if (!currentUserId || !text.trim()) return;
    start(async () => {
      const fd = new FormData();
      fd.set('course_id', courseId); fd.set('item_id', itemId);
      fd.set('comment', text); fd.set('slug', slug);
      await addVipCommentAction(fd);
      // Optimistic
      const tempId = `temp-${Date.now()}`;
      setLocalComments((prev) => [
        ...prev,
        {
          id: tempId, user_id: currentUserId, comment: text,
          created_at: new Date().toISOString(),
          author_name: 'Vos', author_email: null
        }
      ]);
      setText('');
    });
  }

  function delComment(id: string) {
    start(async () => {
      const fd = new FormData();
      fd.set('id', id); fd.set('slug', slug);
      await deleteVipCommentAction(fd);
      setLocalComments((prev) => prev.filter((c) => c.id !== id));
    });
  }

  const canModerate = !!currentUserId && ownerUserIds.includes(currentUserId);

  return (
    <div className="px-2 pb-2 space-y-1.5">
      <div className="flex items-center gap-3 text-xs">
        <button
          type="button"
          onClick={toggleLike}
          disabled={!currentUserId || pending}
          className={`flex items-center gap-1 transition ${
            liked ? 'text-rose-400' : 'text-white/60 hover:text-rose-300'
          } disabled:opacity-40`}
          title={currentUserId ? 'Me gusta' : 'Iniciá sesión para likear'}
        >
          <span className="text-base leading-none">{liked ? '❤️' : '🤍'}</span>
          <span className="font-medium tabular-nums">{likeCount}</span>
        </button>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1 text-white/60 hover:text-white transition"
        >
          <span className="text-base leading-none">💬</span>
          <span className="font-medium tabular-nums">{localComments.length}</span>
        </button>
      </div>

      {open && (
        <div className="space-y-1.5 pt-1.5 border-t border-white/10">
          {localComments.length > 0 && (
            <ul className="space-y-1 max-h-40 overflow-y-auto pr-1">
              {localComments.map((c) => (
                <li key={c.id} className="text-xs text-white/85 flex items-start gap-1.5 group">
                  <span className="font-semibold text-white/95 flex-shrink-0">
                    {c.author_name || c.author_email?.split('@')[0] || 'Anon'}:
                  </span>
                  <span className="flex-1 break-words">{c.comment}</span>
                  {(canModerate || c.user_id === currentUserId) && (
                    <button
                      type="button"
                      onClick={() => delComment(c.id)}
                      className="text-white/40 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition text-[10px]"
                    >✕</button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {currentUserId ? (
            <div className="flex gap-1.5">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); postComment(); } }}
                placeholder="Escribí un comentario…"
                className="flex-1 rounded bg-white/5 border border-white/15 px-2 py-1 text-xs focus:outline-none focus:border-white/40"
              />
              <button
                type="button"
                onClick={postComment}
                disabled={pending || !text.trim()}
                className="rounded bg-white text-black text-xs font-semibold px-2.5 py-1 disabled:opacity-40"
              >
                {pending ? '…' : '↑'}
              </button>
            </div>
          ) : (
            <p className="text-[10px] text-white/40 italic">Iniciá sesión para comentar.</p>
          )}
        </div>
      )}
    </div>
  );
}
